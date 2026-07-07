import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { fleekRecords } from "@/db/schema";
import { eq, or, ilike } from "drizzle-orm";

function normalizeFleekId(raw: string): string {
  return raw.trim().replace(/\//g, "_");
}

export async function GET(request: NextRequest) {
  try {
    const searchParam = request.nextUrl.searchParams.get("q") || "";
    const trimmed = searchParam.trim();

    if (!trimmed) {
      return NextResponse.json({ results: [] });
    }

    const terms = trimmed
      .split(/[,\n\r]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    if (terms.length === 0) {
      return NextResponse.json({ results: [] });
    }

    const normalizedTerms = terms.map(normalizeFleekId);

    const exactConditions = terms.flatMap((term) => {
      const normalized = normalizeFleekId(term);
      return [
        eq(fleekRecords.fleekIdNormalized, normalized),
        eq(fleekRecords.fleekId, term),
      ];
    });

    let results = await db
      .select()
      .from(fleekRecords)
      .where(or(...exactConditions));

    const seen = new Set<number>();
    results = results.filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });

    if (results.length === 0 && normalizedTerms.length === 1) {
      const term = normalizedTerms[0];
      results = await db
        .select()
        .from(fleekRecords)
        .where(
          or(
            ilike(fleekRecords.fleekIdNormalized, `%${term}%`),
            ilike(fleekRecords.fleekId, `%${term}%`)
          )
        );
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
    }));

    return NextResponse.json({ results: formatted, total: formatted.length });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
