import { NextResponse } from "next/server";
import { db } from "@/db";
import { fleekRecords, scanLogs, users, qrCodes } from "@/db/schema";
import { getAuthUser } from "@/lib/auth";
import { sql, desc } from "drizzle-orm";

/**
 * ⚠️ BACKEND DATA IS READ-ONLY
 * This endpoint only READS data - no modifications allowed
 * All data shown here is permanently stored in PostgreSQL
 * NO DELETE operations exist anywhere in this system
 */

export async function GET() {
  try {
    const currentUser = await getAuthUser();
    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ error: "Admin access only" }, { status: 403 });
    }

    const recordCount = await db.select({ count: sql<number>`count(*)` }).from(fleekRecords);
    const qrCount = await db.select({ count: sql<number>`count(*)` }).from(qrCodes);
    const scanCount = await db.select({ count: sql<number>`count(*)` }).from(scanLogs);
    const userCount = await db.select({ count: sql<number>`count(*)` }).from(users);
    const receivedCount = await db.select({ count: sql<number>`count(*)` }).from(fleekRecords).where(sql`received_status = 'received'`);

    const allRecords = await db.select().from(fleekRecords).orderBy(desc(fleekRecords.id)).limit(1000);
    const recentScans = await db.select().from(scanLogs).orderBy(desc(scanLogs.id)).limit(100);

    return NextResponse.json({
      stats: {
        totalRecords: Number(recordCount[0].count),
        totalQrCodes: Number(qrCount[0].count),
        totalScans: Number(scanCount[0].count),
        totalUsers: Number(userCount[0].count),
        totalReceived: Number(receivedCount[0].count),
      },
      records: allRecords.map((r) => ({
        ...r,
        receivedStatus: r.receivedStatus,
        receivedDate: r.receivedDate,
        receivedBoxCount: r.receivedBoxCount,
        receivedBy: r.receivedBy,
      })),
      recentScans,
    });
  } catch (error) {
    console.error("Backend error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
