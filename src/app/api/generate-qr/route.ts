import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { db } from "@/db";
import { qrCodes, fleekRecords } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * ⚠️ IMPORTANT: QR CODES ARE PERMANENT
 * 1. Once a QR code is generated, it is PERMANENTLY stored
 * 2. If QR already exists for a Fleek ID, the existing one is returned (not regenerated)
 * 3. QR codes are NEVER deleted
 * 4. All QR data is permanently stored in PostgreSQL
 */

function normalizeFleekId(raw: string): string {
  return raw.trim().replace(/\//g, "_");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fleekIds } = body as { fleekIds: string[] };

    if (!fleekIds || !Array.isArray(fleekIds) || fleekIds.length === 0) {
      return NextResponse.json(
        { error: "fleekIds array is required" },
        { status: 400 }
      );
    }

    const results: Array<{
      fleekId: string;
      success: boolean;
      qrImageData?: string;
      error?: string;
    }> = [];

    for (const rawFleekId of fleekIds) {
      const fleekId = rawFleekId.trim();
      if (!fleekId) continue;

      const fleekIdNormalized = normalizeFleekId(fleekId);

      try {
        const record = await db
          .select()
          .from(fleekRecords)
          .where(eq(fleekRecords.fleekIdNormalized, fleekIdNormalized))
          .limit(1);

        if (record.length === 0) {
          results.push({
            fleekId,
            success: false,
            error: "Yeh Fleek ID database mein nahi mili — pehle CSV upload karein",
          });
          continue;
        }

        const existingQr = await db
          .select()
          .from(qrCodes)
          .where(eq(qrCodes.fleekIdNormalized, fleekIdNormalized))
          .limit(1);

        if (existingQr.length > 0) {
          results.push({
            fleekId,
            success: true,
            qrImageData: existingQr[0].qrImageData,
          });
          continue;
        }

        const qrDataUrl = await QRCode.toDataURL(fleekId, {
          width: 300,
          margin: 2,
          color: {
            dark: "#000000",
            light: "#FFFFFF",
          },
          errorCorrectionLevel: "M",
        });

        const inserted = await db
          .insert(qrCodes)
          .values({
            fleekId,
            fleekIdNormalized,
            qrImageData: qrDataUrl,
          })
          .returning();

        results.push({
          fleekId,
          success: true,
          qrImageData: inserted[0].qrImageData,
        });
      } catch (err) {
        const errMsg = String(err);
        if (errMsg.includes("unique") || errMsg.includes("duplicate")) {
          const existingQr = await db
            .select()
            .from(qrCodes)
            .where(eq(qrCodes.fleekIdNormalized, fleekIdNormalized))
            .limit(1);

          if (existingQr.length > 0) {
            results.push({
              fleekId,
              success: true,
              qrImageData: existingQr[0].qrImageData,
            });
            continue;
          }
        }
        results.push({
          fleekId,
          success: false,
          error: `QR generate nahi hua: ${errMsg}`,
        });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error("QR generation error:", error);
    return NextResponse.json(
      { error: "Server error. Please try again." },
      { status: 500 }
    );
  }
}
