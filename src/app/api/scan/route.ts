import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { fleekRecords, scanLogs } from "@/db/schema";
import { getAuthUser } from "@/lib/auth";
import { eq, desc, like, or } from "drizzle-orm";

/**
 * ⚠️ IMPORTANT: DATA PRESERVATION RULES
 * 1. Scan logs are PERMANENTLY stored - never deleted
 * 2. Each scan creates a NEW log entry (history preserved)
 * 3. Fleek records are UPDATED with received status (not deleted)
 * 4. All scan history is permanently stored in PostgreSQL
 * 5. NO DELETE operations exist in this system
 */

function normalizeFleekId(raw: string): string {
  return raw.trim().replace(/\//g, "_");
}

// POST - Mark received
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getAuthUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Login required" }, { status: 401 });
    }

    const body = await request.json();
    const { fleekId, boxCount, notes, boxDetails } = body as { fleekId: string; boxCount: string; notes?: string; boxDetails?: string };

    if (!fleekId || !fleekId.trim()) {
      return NextResponse.json({ error: "Fleek ID is required" }, { status: 400 });
    }

    const fleekIdNormalized = normalizeFleekId(fleekId);

    const record = await db
      .select()
      .from(fleekRecords)
      .where(eq(fleekRecords.fleekIdNormalized, fleekIdNormalized))
      .limit(1);

    if (record.length === 0) {
      return NextResponse.json({ error: "Fleek ID not found in database" }, { status: 404 });
    }

    const now = new Date().toISOString();
    const r = record[0];

    await db
      .update(fleekRecords)
      .set({
        receivedStatus: "received",
        receivedDate: now,
        receivedBoxCount: boxCount || null,
        receivedBy: currentUser.name,
      })
      .where(eq(fleekRecords.fleekIdNormalized, fleekIdNormalized));

    await db.insert(scanLogs).values({
      userId: currentUser.id,
      userName: currentUser.name,
      userEmail: currentUser.email,
      fleekId: fleekId.trim(),
      fleekIdNormalized,
      boxCount: boxCount || null,
      notes: notes || null,
      boxDetails: boxDetails || null,
      status: "received",
    });

    return NextResponse.json({
      success: true,
      message: `✅ ${fleekId} marked as received! Box count: ${boxCount || "N/A"}`,
      details: {
        fleekId: r.fleekId,
        vendor: r.vendor,
        quantitySold: r.quantitySold,
        category: r.category,
        customerCountry: r.customerCountry,
        receivedDate: now,
      },
    });
  } catch (error) {
    console.error("Scan error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// GET - List scan/received logs with search
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getAuthUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Login required" }, { status: 401 });
    }

    const searchParam = request.nextUrl.searchParams.get("q") || "";

    let logs;
    if (searchParam.trim()) {
      const term = searchParam.trim();
      const normalized = normalizeFleekId(term);
      logs = await db
        .select()
        .from(scanLogs)
        .where(
          or(
            like(scanLogs.fleekId, `%${term}%`),
            like(scanLogs.fleekIdNormalized, `%${normalized}%`),
            like(scanLogs.userName, `%${term}%`)
          )
        )
        .orderBy(desc(scanLogs.id))
        .limit(500);
    } else {
      logs = await db
        .select()
        .from(scanLogs)
        .orderBy(desc(scanLogs.id))
        .limit(500);
    }

    return NextResponse.json({ logs });
  } catch (error) {
    console.error("Scan logs error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
