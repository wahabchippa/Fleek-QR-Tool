import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { fleekRecords } from "@/db/schema";
import { eq, or, ilike, and, gte, lte, sql } from "drizzle-orm";

function normalizeFleekId(raw: string): string {
  return raw.trim().replace(/\//g, "_");
}

export async function GET(request: NextRequest) {
  try {
    const searchParam = request.nextUrl.searchParams.get("q") || "";
    const dateFrom = request.nextUrl.searchParams.get("dateFrom") || "";
    const dateTo = request.nextUrl.searchParams.get("dateTo") || "";
    const vendor = request.nextUrl.searchParams.get("vendor") || "";
    const status = request.nextUrl.searchParams.get("status") || ""; // "received", "pending", "all"
    const limit = parseInt(request.nextUrl.searchParams.get("limit") || "500");

    const conditions: ReturnType<typeof eq>[] = [];

    // Text search (Fleek IDs)
    const trimmed = searchParam.trim();
    if (trimmed) {
      const terms = trimmed
        .split(/[,\n\r]+/)
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      if (terms.length > 0) {
        const normalizedTerms = terms.map(normalizeFleekId);
        const exactConditions = terms.flatMap((term) => {
          const normalized = normalizeFleekId(term);
          return [
            eq(fleekRecords.fleekIdNormalized, normalized),
            eq(fleekRecords.fleekId, term),
          ];
        });
        conditions.push(or(...exactConditions)!);
      }
    }

    // Date range filter (on createdAt or receivedDate)
    if (dateFrom) {
      conditions.push(gte(fleekRecords.createdAt, dateFrom));
    }
    if (dateTo) {
      // Add 1 day to include the end date fully
      const endDate = new Date(dateTo);
      endDate.setDate(endDate.getDate() + 1);
      conditions.push(lte(fleekRecords.createdAt, endDate.toISOString().slice(0, 10)));
    }

    // Vendor filter
    if (vendor && vendor !== "all") {
      conditions.push(eq(fleekRecords.vendor, vendor));
    }

    // Status filter
    if (status === "received") {
      conditions.push(eq(fleekRecords.receivedStatus, "received"));
    } else if (status === "pending") {
      conditions.push(
        or(
          eq(fleekRecords.receivedStatus, ""),
          sql`${fleekRecords.receivedStatus} IS NULL`
        )!
      );
    }

    // Build query
    let query = db.select().from(fleekRecords);
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    let results = await query.limit(limit);

    // Dedupe by ID
    const seen = new Set<number>();
    results = results.filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });

    // If no results on exact search, try partial match
    if (results.length === 0 && trimmed && !dateFrom && !dateTo && !vendor && !status) {
      const term = normalizeFleekId(trimmed);
      results = await db
        .select()
        .from(fleekRecords)
        .where(
          or(
            ilike(fleekRecords.fleekIdNormalized, `%${term}%`),
            ilike(fleekRecords.fleekId, `%${term}%`)
          )
        )
        .limit(limit);
    }

    const formatted = results.map((r) => ({
      id: r.id,
      fleekId: r.fleekId,
      latestStatus: r.latestStatus,
      latestStatusDate: r.latestStatusDate,
      totalOrderLineAmount: r.totalOrderLineAmount,
      customerCountry: r.customerCountry,
      vendor: r.vendor,
      customerName: r.customerName,
      quantitySold: r.quantitySold,
      category: r.category,
      receivedStatus: r.receivedStatus,
      receivedDate: r.receivedDate,
      receivedBoxCount: r.receivedBoxCount,
      receivedBy: r.receivedBy,
      createdAt: r.createdAt,
    }));

    return NextResponse.json({ results: formatted, total: formatted.length });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}

// GET vendors list for dropdown
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (body.action === "getVendors") {
      const vendorResults = await db
        .select({ vendor: fleekRecords.vendor })
        .from(fleekRecords)
        .groupBy(fleekRecords.vendor);
      
      const vendors = vendorResults
        .map(v => v.vendor)
        .filter(Boolean)
        .sort();
      
      return NextResponse.json({ vendors });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("Search POST error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
