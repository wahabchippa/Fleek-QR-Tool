import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { fleekRecords, scanLogs, sellerGDDetails } from "@/db/schema";
import { getAuthUser } from "@/lib/auth";
import { eq, desc, like, or, and } from "drizzle-orm";
import { logActivity } from "@/lib/activity";

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
    const { fleekId, boxCount, notes, boxDetails, photoUrl } = body as { fleekId: string; boxCount: string; notes?: string; boxDetails?: string; photoUrl?: string };

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
    const today = now.split("T")[0]; // YYYY-MM-DD
    const r = record[0];

    // ═══ 3PL GD BATCH SYNC ═══
    // If this order exists in seller GD rows assigned to this 3PL,
    // scanning once with correct box count should mark the whole batch received.
    let gdBatchInfo: { expectedBoxes: number; uploadDate: string; vendor: string } | null = null;
    if (currentUser.role.startsWith("3pl")) {
      const assignedRows = await db
        .select({
          uploadDate: sellerGDDetails.uploadDate,
          vendor: sellerGDDetails.vendor,
          receivedStatus: sellerGDDetails.receivedStatus,
        })
        .from(sellerGDDetails)
        .where(and(
          eq(sellerGDDetails.fleekId, fleekId.trim()),
          eq(sellerGDDetails.assigned3pl, currentUser.role)
        ));

      const pendingRows = assignedRows.filter((row) => row.receivedStatus !== "received");
      if (pendingRows.length > 0) {
        const latestUploadDate = pendingRows
          .map((row) => row.uploadDate)
          .sort()
          .at(-1) as string;
        const currentBatch = pendingRows.filter((row) => row.uploadDate === latestUploadDate);
        gdBatchInfo = {
          expectedBoxes: currentBatch.length,
          uploadDate: latestUploadDate,
          vendor: currentBatch[0]?.vendor || r.vendor || "",
        };

        const enteredBoxCount = Number(boxCount || 0);
        if (enteredBoxCount > 0 && enteredBoxCount !== gdBatchInfo.expectedBoxes) {
          return NextResponse.json({
            error: `⚠️ This order has ${gdBatchInfo.expectedBoxes} box(es) in GD. Please enter box count ${gdBatchInfo.expectedBoxes} to receive the full batch.`,
            expectedBoxes: gdBatchInfo.expectedBoxes,
            gdBatch: gdBatchInfo,
          }, { status: 400 });
        }
      }
    }

    // ═══ DUPLICATE SCAN CHECK ═══
    // Same order, same day = BLOCK with warning
    // Same order, different day = ALLOW (re-receive)
    const existingScans = await db
      .select({ id: scanLogs.id, userName: scanLogs.userName, scannedAt: scanLogs.scannedAt })
      .from(scanLogs)
      .where(eq(scanLogs.fleekIdNormalized, fleekIdNormalized))
      .orderBy(desc(scanLogs.scannedAt))
      .limit(5);

    if (existingScans.length > 0) {
      const lastScan = existingScans[0];
      const lastScanDate = lastScan.scannedAt.split("T")[0];

      if (lastScanDate === today) {
        // Same day — BLOCK
        const time = new Date(lastScan.scannedAt).toLocaleTimeString();
        return NextResponse.json({
          error: `⚠️ Already received TODAY by ${lastScan.userName} at ${time}. Cannot scan same order twice on same day.`,
          duplicate: true,
          lastScan: { by: lastScan.userName, at: lastScan.scannedAt },
        }, { status: 409 });
      }
      // Different day — allow but inform
    }

    await db
      .update(fleekRecords)
      .set({
        receivedStatus: "received",
        receivedDate: now,
        receivedBoxCount: boxCount || null,
        receivedBy: currentUser.name,
      })
      .where(eq(fleekRecords.fleekIdNormalized, fleekIdNormalized));

    // Sync seller GD rows for this 3PL batch
    if (gdBatchInfo && currentUser.role.startsWith("3pl")) {
      await db
        .update(sellerGDDetails)
        .set({
          receivedStatus: "received",
          receivedAt: now,
          receivedBy: currentUser.name,
        })
        .where(and(
          eq(sellerGDDetails.fleekId, fleekId.trim()),
          eq(sellerGDDetails.assigned3pl, currentUser.role),
          eq(sellerGDDetails.uploadDate, gdBatchInfo.uploadDate)
        ));
    }

    await db.insert(scanLogs).values({
      userId: currentUser.id,
      userName: currentUser.name,
      userEmail: currentUser.email,
      fleekId: fleekId.trim(),
      fleekIdNormalized,
      boxCount: boxCount || null,
      notes: notes || null,
      boxDetails: boxDetails || null,
      photoUrl: photoUrl || null,
      status: "received",
    });

    // Check if it was re-received on a new day
    const isReReceive = existingScans.length > 0;
    await logActivity(currentUser, isReReceive ? "re-received" : "received", fleekId.trim(), `Boxes: ${boxCount || "N/A"}${notes ? ` | Notes: ${notes}` : ""}`);

    return NextResponse.json({
      success: true,
      message: isReReceive
        ? `🔄 ${fleekId} re-received! (Previously received on ${existingScans[0].scannedAt.split("T")[0]})`
        : gdBatchInfo
          ? `✅ ${fleekId} marked as received! ${gdBatchInfo.expectedBoxes} box(es) in this GD batch marked together.`
          : `✅ ${fleekId} marked as received! Box count: ${boxCount || "N/A"}`,
      details: {
        fleekId: r.fleekId,
        vendor: r.vendor,
        quantitySold: r.quantitySold,
        category: r.category,
        customerCountry: r.customerCountry,
        receivedDate: now,
      },
      reReceive: isReReceive,
      gdBatch: gdBatchInfo,
    });
  } catch (error) {
    console.error("Scan error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// GET - List scan/received logs with search
// 3PL users only see their own scans, admin/manager see all
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getAuthUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Login required" }, { status: 401 });
    }

    const searchParam = request.nextUrl.searchParams.get("q") || "";
    const is3pl = currentUser.role.startsWith("3pl");

    // Build base filter — 3PL users only see their own scans
    const userFilter = is3pl ? eq(scanLogs.userId, currentUser.id) : undefined;

    let logs;
    if (searchParam.trim()) {
      const term = searchParam.trim();
      const normalized = normalizeFleekId(term);
      const searchFilter = or(
        like(scanLogs.fleekId, `%${term}%`),
        like(scanLogs.fleekIdNormalized, `%${normalized}%`),
        like(scanLogs.userName, `%${term}%`)
      );
      logs = await db
        .select()
        .from(scanLogs)
        .where(userFilter ? and(userFilter, searchFilter) : searchFilter)
        .orderBy(desc(scanLogs.id))
        .limit(500);
    } else {
      logs = await db
        .select()
        .from(scanLogs)
        .where(userFilter)
        .orderBy(desc(scanLogs.id))
        .limit(500);
    }

    return NextResponse.json({ logs });
  } catch (error) {
    console.error("Scan logs error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PATCH - Admin only - edit a scan log
export async function PATCH(request: NextRequest) {
  try {
    const currentUser = await getAuthUser();
    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ error: "Admin access only" }, { status: 403 });
    }

    const body = await request.json();
    const { logId, boxCount, notes, status } = body as { logId: number; boxCount?: string; notes?: string; status?: string };

    if (!logId) return NextResponse.json({ error: "logId required" }, { status: 400 });

    const updates: Record<string, string | null> = {};
    if (boxCount !== undefined) updates.boxCount = boxCount || null;
    if (notes !== undefined) updates.notes = notes || null;
    if (status !== undefined) updates.status = status;

    if (Object.keys(updates).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

    await db.update(scanLogs).set(updates).where(eq(scanLogs.id, logId));
    await logActivity(currentUser, "edit_scan", `Log #${logId}`, JSON.stringify(updates));
    return NextResponse.json({ success: true, message: "Log updated" });
  } catch (error) {
    console.error("Edit scan log error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE - Admin only - delete a scan log
export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getAuthUser();
    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ error: "Admin access only" }, { status: 403 });
    }

    const { logId } = await request.json() as { logId: number };
    if (!logId) return NextResponse.json({ error: "logId required" }, { status: 400 });

    await db.delete(scanLogs).where(eq(scanLogs.id, logId));
    await logActivity(currentUser, "delete_scan", `Log #${logId}`, "Scan log deleted");
    return NextResponse.json({ success: true, message: "Log deleted" });
  } catch (error) {
    console.error("Delete scan log error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
