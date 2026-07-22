import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sellerGDDetails, sellerUploadSummary } from "@/db/schema";
import { getAuthUser } from "@/lib/auth";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";

function groupBoxRows<T extends { fleekId: string; boxNo: string; weight: string | null; receivedStatus: string | null; createdAt: string }>(rows: T[]) {
  const map = new Map<string, T & { fleekId: string }>();
  for (const row of rows) {
    const key = `${row.createdAt}__${row.boxNo}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...row, fleekId: row.fleekId });
      continue;
    }
    const ids = existing.fleekId.split(",").map((x) => x.trim()).filter(Boolean);
    if (!ids.includes(row.fleekId)) ids.push(row.fleekId);
    const allReceived = existing.receivedStatus === "received" && row.receivedStatus === "received";
    map.set(key, { ...existing, fleekId: ids.join(", "), receivedStatus: allReceived ? "received" : "" });
  }
  return Array.from(map.values());
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getAuthUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Login required" }, { status: 401 });
    }

    const is3pl = currentUser.role.startsWith("3pl");
    const isFleek = ["admin", "manager"].includes(currentUser.role);
    
    if (!is3pl && !isFleek) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const dateParam = request.nextUrl.searchParams.get("date");
    const dateToParam = request.nextUrl.searchParams.get("dateTo");
    const tplParam = request.nextUrl.searchParams.get("tpl");
    const vendorParam = request.nextUrl.searchParams.get("vendor");
    const today = new Date().toISOString().slice(0, 10);
    
    // Date range - empty means no limit (all time)
    const queryDateFrom = dateParam || "";
    const queryDateTo = dateToParam || (dateParam ? dateParam : "");

    // STEP 1: Get ALL detail rows for date range (filtered by role)
    let allDetails;
    if (is3pl) {
      // 3PL sees ALL their assigned orders (all time with optional date filter)
      const conditions = [eq(sellerGDDetails.assigned3pl, currentUser.role)];
      if (queryDateFrom) conditions.push(gte(sellerGDDetails.uploadDate, queryDateFrom));
      if (queryDateTo) conditions.push(lte(sellerGDDetails.uploadDate, queryDateTo));
      allDetails = await db.select().from(sellerGDDetails).where(and(...conditions));
    } else {
      // Fleek (admin/manager) sees all with optional filters
      const conditions = [];
      if (queryDateFrom) conditions.push(gte(sellerGDDetails.uploadDate, queryDateFrom));
      if (queryDateTo) conditions.push(lte(sellerGDDetails.uploadDate, queryDateTo));
      if (tplParam && tplParam !== "all") {
        if (tplParam === "unassigned") {
          conditions.push(eq(sellerGDDetails.assigned3pl, ""));
        } else {
          conditions.push(eq(sellerGDDetails.assigned3pl, tplParam));
        }
      }
      if (vendorParam && vendorParam !== "all") {
        conditions.push(eq(sellerGDDetails.vendor, vendorParam));
      }
      allDetails = conditions.length > 0 
        ? await db.select().from(sellerGDDetails).where(and(...conditions))
        : await db.select().from(sellerGDDetails);
    }

    // STEP 2: Group details by vendor
    const vendorGroups = new Map<string, typeof allDetails>();
    for (const d of allDetails) {
      if (!vendorGroups.has(d.vendor)) vendorGroups.set(d.vendor, []);
      vendorGroups.get(d.vendor)!.push(d);
    }

    // STEP 3: Build stats per vendor from grouped boxes
    const summariesWithStats = Array.from(vendorGroups.entries()).map(([vendor, details]) => {
      const grouped = groupBoxRows(details);
      const totalBoxes = grouped.length;
      const receivedBoxes = grouped.filter(d => d.receivedStatus === "received").length;
      const totalWeight = grouped.reduce((sum, d) => sum + (parseFloat(d.weight || "0") || 0), 0);
      const uniqueOrders = new Set(grouped.flatMap(d => d.fleekId.split(",").map((x) => x.trim()).filter(Boolean))).size;
      const receivedOrders = new Set(grouped.filter(d => d.receivedStatus === "received").flatMap(d => d.fleekId.split(",").map((x) => x.trim()).filter(Boolean))).size;

      return {
        vendor,
        sellerName: details[0]?.sellerName || vendor,
        uploadDate: details[0]?.uploadDate || queryDateFrom,
        assigned3pl: details[0]?.assigned3pl || "",
        totalBoxes,
        receivedBoxes,
        pendingBoxes: totalBoxes - receivedBoxes,
        totalWeight: totalWeight.toFixed(2),
        uniqueOrders,
        receivedOrders,
        pendingOrders: uniqueOrders - receivedOrders,
      };
    });

    // STEP 4: Get filter options (both admin and 3PL get their own dates/vendors)
    let allVendors: string[] = [];
    let allDates: string[] = [];
    
    if (isFleek) {
      // Admin sees all vendors and dates
      const allSummaries = await db.select({
        vendor: sellerGDDetails.vendor,
        uploadDate: sellerGDDetails.uploadDate,
      }).from(sellerGDDetails).orderBy(desc(sellerGDDetails.uploadDate));
      allVendors = [...new Set(allSummaries.map(s => s.vendor))];
      allDates = [...new Set(allSummaries.map(s => s.uploadDate))].sort().reverse();
    } else if (is3pl) {
      // 3PL sees only their assigned vendors and dates
      const ownData = await db.select({
        vendor: sellerGDDetails.vendor,
        uploadDate: sellerGDDetails.uploadDate,
      }).from(sellerGDDetails)
        .where(eq(sellerGDDetails.assigned3pl, currentUser.role))
        .orderBy(desc(sellerGDDetails.uploadDate));
      allVendors = [...new Set(ownData.map(s => s.vendor))];
      allDates = [...new Set(ownData.map(s => s.uploadDate))].sort().reverse();
    }

    const totals = {
      pendingBoxes: summariesWithStats.reduce((a, s) => a + s.pendingBoxes, 0),
      pendingOrders: summariesWithStats.reduce((a, s) => a + s.pendingOrders, 0),
      receivedBoxes: summariesWithStats.reduce((a, s) => a + s.receivedBoxes, 0),
      totalVendors: summariesWithStats.length,
      totalWeight: summariesWithStats.reduce((a, s) => a + (parseFloat(s.totalWeight || "0") || 0), 0).toFixed(2),
    };

    // Get unique 3PLs for filter (admin only)
    const all3plsRaw = isFleek 
      ? await db.select({ assigned3pl: sellerGDDetails.assigned3pl }).from(sellerGDDetails)
      : [];
    const all3pls = [...new Set(all3plsRaw.map(t => t.assigned3pl).filter(t => t && t.startsWith("3pl")))];

    return NextResponse.json({
      summaries: summariesWithStats,
      totals,
      dateFrom: queryDateFrom,
      dateTo: queryDateTo,
      role: currentUser.role,
      filters: { vendors: allVendors, dates: allDates, tpls: all3pls },
    });
  } catch (error) {
    console.error("3PL orders error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getAuthUser();
    if (!currentUser || !currentUser.role.startsWith("3pl")) {
      return NextResponse.json({ error: "3PL access only" }, { status: 403 });
    }

    const body = await request.json();
    const { fleekId, vendor, uploadDate } = body as {
      fleekId: string; vendor: string; uploadDate: string;
    };

    if (!fleekId || !vendor || !uploadDate) {
      return NextResponse.json({ error: "fleekId, vendor, uploadDate required" }, { status: 400 });
    }

    const now = new Date().toISOString();

    await db.update(sellerGDDetails).set({
      receivedStatus: "received",
      receivedAt: now,
      receivedBy: currentUser.name,
    }).where(and(
      eq(sellerGDDetails.fleekId, fleekId),
      eq(sellerGDDetails.vendor, vendor),
      eq(sellerGDDetails.uploadDate, uploadDate),
      eq(sellerGDDetails.assigned3pl, currentUser.role)
    ));

    return NextResponse.json({ success: true, message: `${fleekId} marked as received` });
  } catch (error) {
    console.error("3PL receive error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
