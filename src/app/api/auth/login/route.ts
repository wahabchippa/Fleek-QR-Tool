import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, createSessionToken } from "@/lib/auth";

const ADMIN_EMAIL = "wahab.chippa@joinfleek.com";
const ADMIN_PASSWORD = "2687";
const ADMIN_NAME = "Abdul Wahab";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body as { email: string; password: string };

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Auto-seed admin on first login attempt
    const adminExists = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, "admin"))
      .limit(1);

    if (adminExists.length === 0) {
      await db.insert(users).values({
        email: ADMIN_EMAIL,
        name: ADMIN_NAME,
        passwordHash: hashPassword(ADMIN_PASSWORD),
        role: "admin",
      });
    }

    // Find user by email
    const user = await db
      .select()
      .from(users)
      .where(eq(users.email, trimmedEmail))
      .limit(1);

    if (user.length === 0) {
      return NextResponse.json({ error: "Email not found. Contact admin." }, { status: 401 });
    }

    const foundUser = user[0];

    if (!foundUser.isActive) {
      return NextResponse.json({ error: "Account is disabled. Contact admin." }, { status: 403 });
    }

    if (foundUser.passwordHash !== hashPassword(password)) {
      return NextResponse.json({ error: "Incorrect password!" }, { status: 401 });
    }

    const token = createSessionToken({
      id: foundUser.id,
      email: foundUser.email,
      name: foundUser.name,
      role: foundUser.role,
    });

    const response = NextResponse.json({
      success: true,
      user: { id: foundUser.id, email: foundUser.email, name: foundUser.name, role: foundUser.role },
    });

    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
