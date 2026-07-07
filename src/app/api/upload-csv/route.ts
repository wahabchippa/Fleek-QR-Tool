import { NextRequest, NextResponse } from "next/server";
import { parse } from "csv-parse/sync";
import { db } from "@/db";
import { fleekRecords } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * ⚠️ IMPORTANT: DATA PRESERVATION RULES
 * 1. CSV upload ONLY ADDS new records - existing records are NEVER modified or deleted
 * 2. If a Fleek ID already exists, it is SKIPPED (old data preserved)
 * 3. All data is permanently stored in PostgreSQL
 * 4. NO DELETE operations exist in this system
 * 5. Data can only be ADDED, never removed
 */

// Allow large file uploads - 100MB limit
export const maxDuration = 300; // 5 minutes timeout for large files

function normalizeFleekId(raw: string): string {
  return raw.trim().replace(/\//g, "_");
}

const COLUMN_ALIASES: Record<string, string[]> = {
  fleek_id: ["fleek_id", "fleekid", "fleekid_1", "order_id", "id", "fleek id", "fleekid1"],
  latest_status: ["latest_status", "status", "latest status", "order_status"],
  latest_status_date: ["latest_status_date", "status_date", "latest status date", "date", "order_date"],
  total_order_line_amount: ["total_order_line_amount", "order_line_amount", "amount", "total_amount", "total order line amount", "order_amount", "line_amount"],
  customer_country: ["customer_country", "country", "customer country", "ship_country"],
  vendor: ["vendor", "vendor_name", "seller", "supplier"],
  customer_name: ["customer_name", "customer", "customer name", "buyer", "buyer_name"],
  quantity_sold: ["quantity_sold", "quantity", "qty", "quantity sold", "qty_sold"],
  category: ["category", "product_category", "product category", "item_category"],
};

function mapColumnName(rawKey: string): string {
  const normalized = rawKey.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
  for (const [canonical, aliases] of Object.entries(COLUMN_ALIASES)) {
    if (aliases.includes(normalized) || normalized === canonical) {
      return canonical;
    }
  }
  return normalized;
}

export async function POST(request: NextRequest) {
  try {
    // Get content length for validation
    const contentLength = request.headers.get("content-length");
    const maxSize = 100 * 1024 * 1024; // 100MB
    
    if (contentLength && parseInt(contentLength) > maxSize) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 100MB." },
        { status: 413 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Check file size (100MB limit)
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Maximum size is 100MB.` },
        { status: 413 }
      );
    }

    if (!file.name.endsWith(".csv")) {
      return NextResponse.json(
        { error: "Only CSV files are accepted" },
        { status: 400 }
      );
    }

    console.log(`Processing file: ${file.name}, Size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);

    // Read file as ArrayBuffer then convert to string
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const content = buffer.toString("utf-8");

    let records: Record<string, string>[];
    try {
      records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
        bom: true,
        // Increase max record size for large files
        max_record_size: 10 * 1024 * 1024, // 10MB per record
      });
    } catch (parseErr) {
      console.error("CSV Parse error:", parseErr);
      return NextResponse.json(
        { error: "Invalid CSV format. Please check your file and try again." },
        { status: 400 }
      );
    }

    if (records.length === 0) {
      return NextResponse.json(
        { error: "CSV file is empty — no data rows found" },
        { status: 400 }
      );
    }

    console.log(`Found ${records.length} rows to process`);

    const mappedRecords = records.map((row) => {
      const mapped: Record<string, string> = {};
      for (const [key, value] of Object.entries(row)) {
        const canonical = mapColumnName(key);
        mapped[canonical] = (value || "").trim();
      }
      return mapped;
    });

    let addedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    // Process in batches of 100 for better performance
    const batchSize = 100;
    for (let i = 0; i < mappedRecords.length; i += batchSize) {
      const batch = mappedRecords.slice(i, i + batchSize);
      
      for (const row of batch) {
        const rawFleekId = row.fleek_id || "";

        if (!rawFleekId) {
          skippedCount++;
          continue;
        }

        const fleekId = rawFleekId.trim();
        const fleekIdNormalized = normalizeFleekId(fleekId);

        if (!fleekIdNormalized) {
          skippedCount++;
          continue;
        }

        try {
          // Check if already exists
          const existing = await db
            .select({ id: fleekRecords.id })
            .from(fleekRecords)
            .where(eq(fleekRecords.fleekIdNormalized, fleekIdNormalized))
            .limit(1);

          if (existing.length > 0) {
            skippedCount++;
            continue;
          }

          // Insert new record - PERMANENTLY saved in PostgreSQL
          await db.insert(fleekRecords).values({
            fleekId,
            fleekIdNormalized,
            latestStatus: row.latest_status || null,
            latestStatusDate: row.latest_status_date || null,
            totalOrderLineAmount: row.total_order_line_amount || null,
            customerCountry: row.customer_country || null,
            vendor: row.vendor || null,
            customerName: row.customer_name || null,
            quantitySold: row.quantity_sold || null,
            category: row.category || null,
          });

          addedCount++;
        } catch (err) {
          const errMsg = String(err);
          if (errMsg.includes("unique") || errMsg.includes("duplicate")) {
            skippedCount++;
          } else {
            if (errors.length < 5) {
              errors.push(`Error processing ${fleekId}: ${errMsg}`);
            }
          }
        }
      }
      
      // Log progress for large files
      if (mappedRecords.length > 1000 && i % 1000 === 0) {
        console.log(`Processed ${i + batch.length}/${mappedRecords.length} rows...`);
      }
    }

    console.log(`Upload complete: ${addedCount} added, ${skippedCount} skipped`);

    return NextResponse.json({
      success: true,
      totalRows: mappedRecords.length,
      added: addedCount,
      skipped: skippedCount,
      errors: errors.length > 0 ? errors : undefined,
      message: addedCount > 0
        ? `✅ ${addedCount} new records PERMANENTLY saved in database!`
        : "All records already exist — data is safe!",
    });
  } catch (error) {
    console.error("CSV upload error:", error);
    return NextResponse.json(
      { error: `Server error: ${error instanceof Error ? error.message : "Unknown error"}` },
      { status: 500 }
    );
  }
}
