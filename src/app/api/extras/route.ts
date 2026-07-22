import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { extraItems } from "@/db/schema";
import { getAuthUser } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";
import { logActivity } from "@/lib/activity";

// POST — 3PL reports extra item
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getAuthUser();
    if (!currentUser) return NextResponse.json({ error: "Login required" }, { status: 401 });

    const { fleekId, description, photoUrl } = await request.json() as { fleekId?: string; description: string; photoUrl?: string };

    if (!fleekId?.trim()) return NextResponse.json({ error: "Order / Fleek ID is required" }, { status: 400 });
    if (!description?.trim()) return NextResponse.json({ error: "Description required" }, { status: 400 });
    if (!photoUrl) return NextResponse.json({ error: "Photo is required — attach a picture before submitting" }, { status: 400 });

    await db.insert(extraItems).values({
      fleekId: fleekId?.trim() || null,
      description: description.trim(),
      photoUrl: photoUrl || null,
      reportedById: currentUser.id,
      reportedByName: currentUser.name,
      reportedByRole: currentUser.role,
    });

    await logActivity(currentUser, "report_extra", fleekId?.trim() || "unknown", description.trim());
    return NextResponse.json({ success: true, message: "Extra item reported!" });
  } catch (error) {
    console.error("Report extra error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// GET — list extras (3PL sees own, admin sees all)
export async function GET() {
  try {
    const currentUser = await getAuthUser();
    if (!currentUser) return NextResponse.json({ error: "Login required" }, { status: 401 });

    const is3pl = currentUser.role.startsWith("3pl");
    const items = is3pl
      ? await db.select().from(extraItems).where(eq(extraItems.reportedById, currentUser.id)).orderBy(desc(extraItems.id)).limit(200)
      : await db.select().from(extraItems).orderBy(desc(extraItems.id)).limit(500);

    return NextResponse.json({ items });
  } catch (error) {
    console.error("List extras error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PATCH — admin reviews extra (acknowledge/resolve)
export async function PATCH(request: NextRequest) {
  try {
    const currentUser = await getAuthUser();
    if (!currentUser || !["admin", "manager"].includes(currentUser.role)) return NextResponse.json({ error: "Admin only" }, { status: 403 });

    const { itemId, status, adminNotes } = await request.json() as { itemId: number; status: string; adminNotes?: string };
    if (!itemId || !status) return NextResponse.json({ error: "itemId and status required" }, { status: 400 });

    await db.update(extraItems).set({
      status,
      adminNotes: adminNotes || null,
      reviewedBy: currentUser.name,
      reviewedAt: new Date().toISOString(),
    }).where(eq(extraItems.id, itemId));

    await logActivity(currentUser, "review_extra", `Extra #${itemId}`, `Status: ${status}${adminNotes ? ` | Note: ${adminNotes}` : ""}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Review extra error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
