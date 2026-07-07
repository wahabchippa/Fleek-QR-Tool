import { NextResponse } from "next/server";
import { db } from "@/db";
import { qrCodes } from "@/db/schema";
import { desc } from "drizzle-orm";

/**
 * ⚠️ IMPORTANT: QR codes are PERMANENTLY stored
 * Once generated, QR codes are never deleted
 * All QR data is permanently stored in PostgreSQL
 */

export async function GET() {
  try {
    const codes = await db
      .select({
        id: qrCodes.id,
        fleekId: qrCodes.fleekId,
        fleekIdNormalized: qrCodes.fleekIdNormalized,
        qrImageData: qrCodes.qrImageData,
        createdAt: qrCodes.createdAt,
      })
      .from(qrCodes)
      .orderBy(desc(qrCodes.createdAt));

    return NextResponse.json({ qrCodes: codes });
  } catch (error) {
    console.error("Fetch QR codes error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
