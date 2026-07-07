import { NextResponse } from "next/server";
import { db } from "@/db";
import { fleekRecords, qrCodes } from "@/db/schema";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    const rc = await db.select({ count: sql<number>`count(*)` }).from(fleekRecords);
    const qc = await db.select({ count: sql<number>`count(*)` }).from(qrCodes);
    return NextResponse.json({
      totalRecords: Number(rc[0].count),
      totalQrCodes: Number(qc[0].count),
    });
  } catch (error) {
    console.error("Stats error:", error);
    return NextResponse.json({ totalRecords: 0, totalQrCodes: 0 });
  }
}
