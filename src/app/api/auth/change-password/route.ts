import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getAuthUser, hashPassword } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getAuthUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Login required" }, { status: 401 });
    }

    const body = await request.json();
    const { userId, newPassword, currentPassword } = body as {
      userId: number;
      newPassword: string;
      currentPassword?: string;
    };

    if (!userId || !newPassword || newPassword.length < 3) {
      return NextResponse.json(
        { error: "User ID and new password (min 3 chars) required" },
        { status: 400 }
      );
    }

    // Admin can change anyone's password
    if (currentUser.role === "admin") {
      if (userId === currentUser.id && currentPassword) {
        const adminUser = await db
          .select({ passwordHash: users.passwordHash })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        if (adminUser.length === 0 || adminUser[0].passwordHash !== hashPassword(currentPassword)) {
          return NextResponse.json(
            { error: "Current password is incorrect" },
            { status: 400 }
          );
        }
      }

      await db
        .update(users)
        .set({ passwordHash: hashPassword(newPassword) })
        .where(eq(users.id, userId));

      return NextResponse.json({ success: true, message: "Password updated successfully" });
    }

    // Non-admin can only change their own password
    if (userId !== currentUser.id) {
      return NextResponse.json({ error: "You can only change your own password" }, { status: 403 });
    }

    if (!currentPassword) {
      return NextResponse.json({ error: "Current password is required" }, { status: 400 });
    }

    const userRecord = await db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, currentUser.id))
      .limit(1);

    if (userRecord.length === 0 || userRecord[0].passwordHash !== hashPassword(currentPassword)) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }

    await db
      .update(users)
      .set({ passwordHash: hashPassword(newPassword) })
      .where(eq(users.id, currentUser.id));

    return NextResponse.json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
