import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { scanLogs, fleekRecords } from "@/db/schema";
import { getAuthUser } from "@/lib/auth";
import { desc, eq, and, gte, lte, like, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getAuthUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Login required" }, { status: 401 });
    }

    const params = request.nextUrl.searchParams;
    const dateFrom = params.get("from") || "";
    const dateTo = params.get("to") || "";
    const roleFilter = params.get("role") || "";  // 3pl_ecl, 3pl_ge, or empty for all
    const type = params.get("type") || "received"; // received or orders

    // 3PL users can only export their own data
    const is3pl = currentUser.role.startsWith("3pl");

    if (type === "received") {
      // Build conditions array
      const conditions = [];

      // 3PL filter — own data only
      if (is3pl) {
        conditions.push(eq(scanLogs.userId, currentUser.id));
      } else if (roleFilter) {
        // Admin filtering by 3PL company
        conditions.push(like(scanLogs.userEmail, roleFilter === "3pl_ecl" ? "%ecl%" : "%ge%"));
      }

      // Date filters
      if (dateFrom) conditions.push(gte(scanLogs.scannedAt, dateFrom));
      if (dateTo) conditions.push(lte(scanLogs.scannedAt, dateTo + "T23:59:59"));

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const logs = await db
        .select()
        .from(scanLogs)
        .where(whereClause)
        .orderBy(desc(scanLogs.scannedAt))
        .limit(10000);

      // Build CSV
      const headers = ["Fleek ID", "Scanned By", "Email", "Box Count", "Notes", "Status", "Scanned At"];
      const rows = logs.map(l => [
        l.fleekId, l.userName, l.userEmail, l.boxCount || "", l.notes || "", l.status, l.scannedAt
      ]);

      // Date summary
      const dateSummary: Record<string, number> = {};
      logs.forEach(l => {
        const date = l.scannedAt.split("T")[0];
        dateSummary[date] = (dateSummary[date] || 0) + 1;
      });

      return NextResponse.json({
        logs,
        csv: { headers, rows },
        summary: {
          total: logs.length,
          dateWise: Object.entries(dateSummary).map(([date, count]) => ({ date, count })).sort((a, b) => b.date.localeCompare(a.date)),
        }
      });
    }

    if (type === "orders") {
      // Only admin/manager can export all orders
      if (is3pl) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      const conditions = [];
      if (dateFrom) conditions.push(gte(fleekRecords.createdAt, dateFrom));
      if (dateTo) conditions.push(lte(fleekRecords.createdAt, dateTo + "T23:59:59"));

      const statusFilter = params.get("status");
      if (statusFilter === "received") conditions.push(eq(fleekRecords.receivedStatus, "received"));
      if (statusFilter === "pending") conditions.push(sql`received_status IS NULL`);

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const orders = await db
        .select()
        .from(fleekRecords)
        .where(whereClause)
        .orderBy(desc(fleekRecords.id))
        .limit(10000);

      return NextResponse.json({
        orders,
        summary: {
          total: orders.length,
          received: orders.filter(o => o.receivedStatus === "received").length,
          pending: orders.filter(o => !o.receivedStatus).length,
        }
      });
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
