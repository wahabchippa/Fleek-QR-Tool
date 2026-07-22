import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { qrCodes } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { getAuthUser } from "@/lib/auth";

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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE - Admin only - delete a QR code
export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getAuthUser();
    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ error: "Admin access only" }, { status: 403 });
    }

    const { qrId } = await request.json() as { qrId: number };
    if (!qrId) {
      return NextResponse.json({ error: "qrId required" }, { status: 400 });
    }

    await db.delete(qrCodes).where(eq(qrCodes.id, qrId));
    return NextResponse.json({ success: true, message: "QR code deleted" });
  } catch (error) {
    console.error("Delete QR error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
