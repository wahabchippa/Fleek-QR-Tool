import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { fleekRecords } from "@/db/schema";
import { sql } from "drizzle-orm";
import { getAuthUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

/**
 * ⚠️ DATA PRESERVATION RULES
 * 1. CSV upload ONLY ADDS new records - existing NEVER modified/deleted
 * 2. Duplicate Fleek IDs SKIPPED via ON CONFLICT DO NOTHING
 * 3. All data permanently stored in PostgreSQL
 * 4. NO DELETE operations exist
 */

export const maxDuration = 300;
export const dynamic = "force-dynamic";

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
    if (aliases.includes(normalized) || normalized === canonical) return canonical;
  }
  return normalized;
}

function esc(val: string | null): string {
  if (val === null || val === undefined || val === "") return "NULL";
  return "'" + val.replace(/'/g, "''") + "'";
}

async function bulkInsertRows(rows: Record<string, string>[]) {
  const validRows: {
    fleekId: string; fleekIdNormalized: string;
    latestStatus: string | null; latestStatusDate: string | null;
    totalOrderLineAmount: string | null; customerCountry: string | null;
    vendor: string | null; customerName: string | null;
    quantitySold: string | null; category: string | null;
  }[] = [];

  for (const row of rows) {
    const raw = row.fleek_id || "";
    if (!raw) continue;
    const fleekId = raw.trim();
    const norm = normalizeFleekId(fleekId);
    if (!norm) continue;
    validRows.push({
      fleekId, fleekIdNormalized: norm,
      latestStatus: row.latest_status || null,
      latestStatusDate: row.latest_status_date || null,
      totalOrderLineAmount: row.total_order_line_amount || null,
      customerCountry: row.customer_country || null,
      vendor: row.vendor || null,
      customerName: row.customer_name || null,
      quantitySold: row.quantity_sold || null,
      category: row.category || null,
    });
  }

  if (validRows.length === 0) return { added: 0, skipped: rows.length };

  // Build raw SQL for maximum compatibility — works on every Postgres
  const valuesList = validRows.map((r) =>
    `(${esc(r.fleekId)}, ${esc(r.fleekIdNormalized)}, ${esc(r.latestStatus)}, ${esc(r.latestStatusDate)}, ${esc(r.totalOrderLineAmount)}, ${esc(r.customerCountry)}, ${esc(r.vendor)}, ${esc(r.customerName)}, ${esc(r.quantitySold)}, ${esc(r.category)}, NOW())`
  ).join(",\n");

  const query = `
    INSERT INTO fleek_records 
      (fleek_id, fleek_id_normalized, latest_status, latest_status_date, total_order_line_amount, customer_country, vendor, customer_name, quantity_sold, category, created_at)
    VALUES ${valuesList}
    ON CONFLICT (fleek_id_normalized) DO NOTHING;
  `;

  const result = await db.execute(sql.raw(query));

  // rowCount = number of rows actually inserted (duplicates are skipped)
  const added = typeof result === "object" && result !== null && "rowCount" in result
    ? Number((result as { rowCount: number }).rowCount)
    : 0;
  const skipped = rows.length - added;

  return { added, skipped };
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = await request.json();
      const { rows, chunkIndex, totalChunks } = body as {
        rows: Record<string, string>[];
        chunkIndex: number;
        totalChunks: number;
      };

      if (!rows || !Array.isArray(rows) || rows.length === 0) {
        return NextResponse.json({ error: "No rows in chunk" }, { status: 400 });
      }

      const mappedRows = rows.map((row) => {
        const mapped: Record<string, string> = {};
        for (const [key, value] of Object.entries(row)) {
          mapped[mapColumnName(key)] = (value || "").trim();
        }
        return mapped;
      });

      const result = await bulkInsertRows(mappedRows);

      // Log on last chunk
      if (chunkIndex === totalChunks - 1 && result.added > 0) {
        const user = await getAuthUser();
        if (user) await logActivity(user, "csv_upload", "orders", `Chunk ${chunkIndex+1}/${totalChunks}: +${result.added} added, ${result.skipped} skipped`);
      }

      return NextResponse.json({
        success: true,
        chunkIndex,
        totalChunks,
        added: result.added,
        skipped: result.skipped,
        chunkRows: mappedRows.length,
      });
    }

    if (contentType.includes("multipart/form-data")) {
      const { parse } = await import("csv-parse/sync");
      const formData = await request.formData();
      const file = formData.get("file") as File | null;

      if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
      if (!file.name.endsWith(".csv")) return NextResponse.json({ error: "CSV only" }, { status: 400 });

      const buffer = Buffer.from(await file.arrayBuffer());

      let records: Record<string, string>[];
      try {
        records = parse(buffer.toString("utf-8"), { columns: true, skip_empty_lines: true, trim: true, relax_column_count: true, bom: true });
      } catch {
        return NextResponse.json({ error: "Invalid CSV" }, { status: 400 });
      }

      if (records.length === 0) return NextResponse.json({ error: "CSV empty" }, { status: 400 });

      const mappedRows = records.map((row) => {
        const mapped: Record<string, string> = {};
        for (const [key, value] of Object.entries(row)) {
          mapped[mapColumnName(key)] = (value || "").trim();
        }
        return mapped;
      });

      const result = await bulkInsertRows(mappedRows);

      return NextResponse.json({
        success: true,
        totalRows: mappedRows.length,
        added: result.added,
        skipped: result.skipped,
      });
    }

    return NextResponse.json({ error: "Invalid content type" }, { status: 400 });
  } catch (error) {
    console.error("Upload error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Upload failed: ${msg}` }, { status: 500 });
  }
}
