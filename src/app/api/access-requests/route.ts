import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { accessRequests, users } from "@/db/schema";
import { getAuthUser, hashPassword } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";

/**
 * ⚠️ Access requests are NEVER deleted - only status changes
 * POST (public)  - Submit new request
 * GET  (admin/manager) - List all requests
 * PATCH (admin/manager) - Approve/reject a request
 */

// POST - Submit access request (public, no auth needed)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, message } = body as { name: string; email: string; message?: string };

    if (!name?.trim() || !email?.trim()) {
      return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Check if user already exists
    const existingUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, trimmedEmail))
      .limit(1);

    if (existingUser.length > 0) {
      return NextResponse.json({ error: "This email already has an account. Try signing in." }, { status: 400 });
    }

    // Check if pending request already exists
    const existingReq = await db
      .select({ id: accessRequests.id, status: accessRequests.status })
      .from(accessRequests)
      .where(eq(accessRequests.email, trimmedEmail))
      .limit(1);

    if (existingReq.length > 0 && existingReq[0].status === "pending") {
      return NextResponse.json({ error: "A request for this email is already pending." }, { status: 400 });
    }

    await db.insert(accessRequests).values({
      name: name.trim(),
      email: trimmedEmail,
      message: message?.trim() || null,
    });

    return NextResponse.json({ success: true, message: "Request submitted successfully!" });
  } catch (error) {
    console.error("Access request error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// GET - List all access requests (admin/manager only)
export async function GET() {
  try {
    const currentUser = await getAuthUser();
    if (!currentUser || !["admin", "manager"].includes(currentUser.role)) {
      return NextResponse.json({ error: "Admin or Manager access only" }, { status: 403 });
    }

    const requests = await db
      .select()
      .from(accessRequests)
      .orderBy(desc(accessRequests.id));

    return NextResponse.json({ requests });
  } catch (error) {
    console.error("List access requests error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PATCH - Approve or reject a request (admin/manager only)
export async function PATCH(request: NextRequest) {
  try {
    const currentUser = await getAuthUser();
    if (!currentUser || !["admin", "manager"].includes(currentUser.role)) {
      return NextResponse.json({ error: "Admin or Manager access only" }, { status: 403 });
    }

    const body = await request.json();
    const { requestId, action, role, password } = body as {
      requestId: number;
      action: "approve" | "reject";
      role?: string;
      password?: string;
    };

    if (!requestId || !action) {
      return NextResponse.json({ error: "requestId and action required" }, { status: 400 });
    }

    // Find the request
    const req = await db
      .select()
      .from(accessRequests)
      .where(eq(accessRequests.id, requestId))
      .limit(1);

    if (req.length === 0) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    if (req[0].status !== "pending") {
      return NextResponse.json({ error: "Request already processed" }, { status: 400 });
    }

    const now = new Date().toISOString();

    if (action === "reject") {
      await db
        .update(accessRequests)
        .set({ status: "rejected", reviewedBy: currentUser.name, reviewedAt: now })
        .where(eq(accessRequests.id, requestId));

      return NextResponse.json({ success: true, message: "Request rejected" });
    }

    // Approve - create user account
    if (action === "approve") {
      // Only allow employee, manager, 3pl roles (NOT admin)
      const validRoles = ["employee", "manager", "3pl_ecl", "3pl_ge"];
      const assignRole = role && validRoles.includes(role) ? role : "employee";
      const assignPassword = password?.trim() || "fleek123"; // Default password

      // Check email not already taken
      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, req[0].email))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(accessRequests)
          .set({ status: "approved", assignedRole: assignRole, reviewedBy: currentUser.name, reviewedAt: now })
          .where(eq(accessRequests.id, requestId));
        return NextResponse.json({ success: true, message: "User already exists, request marked approved" });
      }

      // Create the user
      await db.insert(users).values({
        email: req[0].email,
        name: req[0].name,
        passwordHash: hashPassword(assignPassword),
        plainPassword: assignPassword,
        role: assignRole,
      });

      // Update request status
      await db
        .update(accessRequests)
        .set({ status: "approved", assignedRole: assignRole, reviewedBy: currentUser.name, reviewedAt: now })
        .where(eq(accessRequests.id, requestId));

      return NextResponse.json({
        success: true,
        message: `${req[0].name} approved as ${assignRole}. Password: ${assignPassword}`,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Process access request error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
