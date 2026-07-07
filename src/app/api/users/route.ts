import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getAuthUser, hashPassword } from "@/lib/auth";
import { eq } from "drizzle-orm";

/**
 * ⚠️ IMPORTANT: NO DELETE OPERATIONS ALLOWED
 * Users are NEVER deleted - only disabled (isActive = false)
 * All user data is permanently stored in PostgreSQL
 * This is by design - data preservation is critical
 */

export async function GET() {
  try {
    const currentUser = await getAuthUser();
    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ error: "Admin access only" }, { status: 403 });
    }

    const allUsers = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(users.createdAt);

    return NextResponse.json({ users: allUsers });
  } catch (error) {
    console.error("Users list error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getAuthUser();
    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ error: "Admin access only" }, { status: 403 });
    }

    const body = await request.json();
    const { email, name, password, role } = body as {
      email: string;
      name: string;
      password: string;
      role: string;
    };

    if (!email || !name || !password || !role) {
      return NextResponse.json(
        { error: "Sab fields bharna zaroori hai: email, name, password, role" },
        { status: 400 }
      );
    }

    const validRoles = ["employee", "manager", "3pl"];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: "Role sirf yeh ho sakta hai: employee, manager, 3pl" },
        { status: 400 }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, trimmedEmail))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Yeh email pehle se hai. Koi aur email use karein." },
        { status: 400 }
      );
    }

    const newUser = await db
      .insert(users)
      .values({
        email: trimmedEmail,
        name: name.trim(),
        passwordHash: hashPassword(password),
        role,
      })
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        isActive: users.isActive,
      });

    return NextResponse.json({ success: true, user: newUser[0] });
  } catch (error) {
    console.error("Add user error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const currentUser = await getAuthUser();
    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ error: "Admin access only" }, { status: 403 });
    }

    const body = await request.json();
    const { userId, isActive } = body as {
      userId: number;
      isActive: boolean;
    };

    if (!userId || isActive === undefined) {
      return NextResponse.json(
        { error: "userId aur isActive chahiye" },
        { status: 400 }
      );
    }

    const targetUser = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (targetUser.length > 0 && targetUser[0].role === "admin") {
      return NextResponse.json(
        { error: "Admin ko disable nahi kar sakte" },
        { status: 400 }
      );
    }

    await db
      .update(users)
      .set({ isActive })
      .where(eq(users.id, userId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
