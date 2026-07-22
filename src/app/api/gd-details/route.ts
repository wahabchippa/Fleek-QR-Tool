import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sellerGDDetails, sellerUploadSummary } from "@/db/schema";
import { getAuthUser } from "@/lib/auth";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";

function groupBoxRows<T extends { fleekId: string; pieces: string | null; boxNo: string; weight: string | null; height: string | null; length: string | null; width: string | null; dimensionalWeight: string | null; receivedStatus: string | null; createdAt: string; uploadDate: string }>(rows: T[]) {
  const map = new Map<string, T & { fleekId: string; pieces: string | null }>();
  for (const row of rows) {
    const key = `${row.createdAt}__${row.boxNo}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...row, fleekId: row.fleekId, pieces: row.pieces || "" });
      continue;
    }
    const ids = existing.fleekId.split(",").map((x) => x.trim()).filter(Boolean);
    if (!ids.includes(row.fleekId)) ids.push(row.fleekId);
    const pcs = String(existing.pieces || "").split(",").map((x) => x.trim()).filter((x, i, a) => !(x === "" && i === a.length - 1));
    pcs.push(row.pieces || "");
    const allReceived = existing.receivedStatus === "received" && row.receivedStatus === "received";
    map.set(key, {
      ...existing,
      fleekId: ids.join(", "),
      pieces: pcs.join(", "),
      receivedStatus: allReceived ? "received" : "",
    });
  }
  return Array.from(map.values());
}

/**
 * GD DETAILS API - For Fleek side
 * GET - Get summary of all sellers by date, or details for specific vendor
 * PATCH - Assign 3PL to a seller's batch
 */

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getAuthUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Login required" }, { status: 401 });
    }

    const allowedRoles = ["admin", "manager", "employee"];
    if (!allowedRoles.includes(currentUser.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const dateParam = request.nextUrl.searchParams.get("date");
    const dateToParam = request.nextUrl.searchParams.get("dateTo");
    const vendorParam = request.nextUrl.searchParams.get("vendor");
    const summaryOnly = request.nextUrl.searchParams.get("summary") === "true";

    // Get all unique dates — from BOTH summary and details tables for completeness
    const allSummaries = await db
      .select()
      .from(sellerUploadSummary)
      .orderBy(desc(sellerUploadSummary.uploadDate));

    // Also check sellerGDDetails for dates that might not be in summary yet
    const allDetailDatesRaw = await db
      .select({ uploadDate: sellerGDDetails.uploadDate })
      .from(sellerGDDetails);
    const detailDates = [...new Set(allDetailDatesRaw.map(d => d.uploadDate))];
    const summaryDates = [...new Set(allSummaries.map(s => s.uploadDate))];
    const uniqueDates = [...new Set([...summaryDates, ...detailDates])].sort().reverse();

    // If summary only requested (for date-wise seller summary)
    if (summaryOnly && dateParam) {
      const fromDate = dateParam;
      const toDate = dateToParam || dateParam;

      // Fetch detail rows for the date range directly from sellerGDDetails using SQL filter
      const filteredDetails = await db
        .select()
        .from(sellerGDDetails)
        .where(and(
          gte(sellerGDDetails.uploadDate, fromDate),
          lte(sellerGDDetails.uploadDate, toDate)
        ))
        .orderBy(sellerGDDetails.createdAt);

      // Group by vendor (across all dates in range)
      const vendorDetailsMap = new Map<string, typeof filteredDetails>();
      for (const d of filteredDetails) {
        if (!vendorDetailsMap.has(d.vendor)) vendorDetailsMap.set(d.vendor, []);
        vendorDetailsMap.get(d.vendor)!.push(d);
      }

      // Build summaries from actual detail data
      const summariesWithReceived = Array.from(vendorDetailsMap.entries()).map(([vendor, details]) => {
        const grouped = groupBoxRows(details);
        const receivedBoxes = grouped.filter((g) => g.receivedStatus === "received").length;
        const totalWeight = grouped.reduce((sum, g) => sum + (parseFloat(g.weight || "0") || 0), 0);
        const uniqueOrders = new Set(grouped.flatMap((g) => g.fleekId.split(",").map((x) => x.trim()).filter(Boolean))).size;

        // Get summary-level info (assigned3pl etc.) from summary table
        const summaryMatch = allSummaries.find(s => s.vendor === vendor && s.uploadDate >= fromDate && s.uploadDate <= toDate);

        return {
          id: summaryMatch?.id || 0,
          sellerId: details[0]?.sellerId || 0,
          sellerName: details[0]?.sellerName || vendor,
          sellerEmail: details[0]?.sellerEmail || "",
          vendor,
          uploadDate: details[0]?.uploadDate || fromDate,
          totalOrders: uniqueOrders,
          totalBoxes: grouped.length,
          receivedBoxes,
          pendingBoxes: Math.max(0, grouped.length - receivedBoxes),
          totalWeight: totalWeight.toFixed(2),
          assigned3pl: summaryMatch?.assigned3pl || details[0]?.assigned3pl || "",
          assignedAt: summaryMatch?.assignedAt || "",
          assignedBy: summaryMatch?.assignedBy || "",
          createdAt: details[0]?.createdAt || "",
        };
      });

      return NextResponse.json({
        summaries: summariesWithReceived,
        dates: uniqueDates,
        selectedDate: dateParam,
      });
    }

    // If specific vendor details requested
    if (dateParam && vendorParam) {
      const rawDetails = await db
        .select()
        .from(sellerGDDetails)
        .where(and(
          eq(sellerGDDetails.uploadDate, dateParam),
          eq(sellerGDDetails.vendor, vendorParam)
        ))
        .orderBy(sellerGDDetails.createdAt, sellerGDDetails.boxNo);

      const details = groupBoxRows(rawDetails);
      const uniqueOrders = new Set(details.flatMap(d => d.fleekId.split(",").map((x) => x.trim()).filter(Boolean))).size;
      const totalBoxes = details.length;
      const receivedBoxes = details.filter(d => d.receivedStatus === "received").length;

      // Get vendors for this date from detail rows directly
      const dateVendorsRaw = await db
        .select({ vendor: sellerGDDetails.vendor })
        .from(sellerGDDetails)
        .where(eq(sellerGDDetails.uploadDate, dateParam));
      const dateVendors = [...new Set(dateVendorsRaw.map(v => v.vendor))];

      return NextResponse.json({
        details,
        summary: { totalOrders: uniqueOrders, totalBoxes, receivedBoxes, pendingBoxes: totalBoxes - receivedBoxes },
        vendors: dateVendors,
        dates: uniqueDates,
        filters: { date: dateParam, vendor: vendorParam },
      });
    }

    // Just return dates for initial load
    return NextResponse.json({
      details: [],
      summaries: [],
      summary: null,
      vendors: [],
      dates: uniqueDates,
      filters: { date: null, vendor: null },
    });
  } catch (error) {
    console.error("GD Details fetch error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PATCH - Assign 3PL to seller batch
export async function PATCH(request: NextRequest) {
  try {
    const currentUser = await getAuthUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Login required" }, { status: 401 });
    }

    const allowedRoles = ["admin", "manager", "employee"];
    if (!allowedRoles.includes(currentUser.role)) {
      return NextResponse.json({ error: "Admin/Manager/Employee access only" }, { status: 403 });
    }

    const body = await request.json();
    const { summaryId, vendor, uploadDate, assigned3pl } = body as {
      summaryId?: number;
      vendor: string;
      uploadDate: string;
      assigned3pl: string; // "3pl_ecl" or "3pl_ge"
    };

    if (!vendor || !uploadDate || !assigned3pl) {
      return NextResponse.json({ error: "vendor, uploadDate, and assigned3pl required" }, { status: 400 });
    }

    if (!["3pl_ecl", "3pl_ge", "pending"].includes(assigned3pl)) {
      return NextResponse.json({ error: "Invalid 3PL value" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const setValue = assigned3pl === "pending" ? "" : assigned3pl;

    // Update all GD details for this vendor + date
    await db
      .update(sellerGDDetails)
      .set({
        assigned3pl: setValue,
        assignedAt: assigned3pl === "pending" ? "" : now,
        assignedBy: assigned3pl === "pending" ? "" : currentUser.name,
      })
      .where(and(
        eq(sellerGDDetails.vendor, vendor),
        eq(sellerGDDetails.uploadDate, uploadDate)
      ));

    // Update summary record
    await db
      .update(sellerUploadSummary)
      .set({
        assigned3pl: setValue,
        assignedAt: assigned3pl === "pending" ? "" : now,
        assignedBy: assigned3pl === "pending" ? "" : currentUser.name,
      })
      .where(and(
        eq(sellerUploadSummary.vendor, vendor),
        eq(sellerUploadSummary.uploadDate, uploadDate)
      ));

    const msg = assigned3pl === "pending" 
      ? `${vendor} unassigned — back to pending`
      : `Assigned ${vendor} to ${assigned3pl === "3pl_ecl" ? "ECL" : "GE"}`;

    return NextResponse.json({ success: true, message: msg });
  } catch (error) {
    console.error("3PL assignment error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
