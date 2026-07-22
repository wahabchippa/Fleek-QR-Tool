import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { userPermissions, users } from "@/db/schema";
import { getAuthUser } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { logActivity } from "@/lib/activity";
import { pool } from "@/db";

// All available tabs/permissions in the system
const ALL_TABS = [
  "upload",
  "search",
  "qrcodes",
  "received",
  "gddetails",
  "sellerview",
  "3plview",
  "extras",
  "activity",
  "backend",
  "users",
  "granted",
] as const;

// Default permissions based on role
function getDefaultPermissions(role: string): Record<string, boolean> {
  const perms: Record<string, boolean> = {};
  
  switch (role) {
    case "admin":
      ALL_TABS.forEach(t => { perms[t] = true; });
      break;
    case "manager":
      perms.upload = true;
      perms.search = true;
      perms.qrcodes = true;
      perms.received = true;
      perms.gddetails = true;
      perms.sellerview = true;
      perms["3plview"] = true;
      perms.extras = false;
      perms.activity = true;
      perms.backend = false;
      perms.users = false;
      perms.granted = false;
      break;
    case "employee":
      perms.upload = false;
      perms.search = true;
      perms.qrcodes = true;
      perms.received = true;
      perms.gddetails = true;
      perms.sellerview = false;
      perms["3plview"] = false;
      perms.extras = false;
      perms.activity = false;
      perms.backend = false;
      perms.users = false;
      perms.granted = false;
      break;
    case "seller":
      ALL_TABS.forEach(t => { perms[t] = false; });
      perms.search = true;
      break;
    case "3pl_ecl":
    case "3pl_ge":
      ALL_TABS.forEach(t => { perms[t] = false; });
      perms.received = true;
      perms.gddetails = true;
      break;
    default:
      ALL_TABS.forEach(t => { perms[t] = false; });
      perms.search = true;
      break;
  }
  
  return perms;
}

// Auto-create user_permissions table if it doesn't exist
async function ensureTable(): Promise<boolean> {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_permissions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL UNIQUE,
        permissions JSONB NOT NULL,
        updated_by TEXT,
        created_at TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT ''
      );
    `);
    return true;
  } catch (err) {
    console.error("Could not ensure user_permissions table:", err);
    return false;
  }
}

// Safe query - returns empty array if table doesn't exist
async function safeGetAllPerms(): Promise<{ userId: number; permissions: Record<string, boolean>; updatedBy: string | null; updatedAt: string }[]> {
  try {
    const allPerms = await db
      .select({
        userId: userPermissions.userId,
        permissions: userPermissions.permissions,
        updatedBy: userPermissions.updatedBy,
        updatedAt: userPermissions.updatedAt,
      })
      .from(userPermissions);
    return allPerms.map(p => ({
      ...p,
      permissions: p.permissions as Record<string, boolean>,
      updatedAt: p.updatedAt ?? "",
    }));
  } catch {
    // Table might not exist — try creating it
    const created = await ensureTable();
    if (created) {
      try {
        const allPerms = await db
          .select({
            userId: userPermissions.userId,
            permissions: userPermissions.permissions,
            updatedBy: userPermissions.updatedBy,
            updatedAt: userPermissions.updatedAt,
          })
          .from(userPermissions);
        return allPerms.map(p => ({
          ...p,
          permissions: p.permissions as Record<string, boolean>,
          updatedAt: p.updatedAt ?? "",
        }));
      } catch { return []; }
    }
    return [];
  }
}

async function safeGetUserPerms(userId: number): Promise<Record<string, boolean> | null> {
  try {
    const existing = await db
      .select({ permissions: userPermissions.permissions })
      .from(userPermissions)
      .where(eq(userPermissions.userId, userId))
      .limit(1);
    if (existing.length > 0) {
      return existing[0].permissions as Record<string, boolean>;
    }
    return null;
  } catch {
    await ensureTable();
    return null;
  }
}

// GET - Get all users with permissions (admin only) OR get own permissions
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getAuthUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode");

    if (mode === "own") {
      const saved = await safeGetUserPerms(currentUser.id);
      if (saved) {
        return NextResponse.json({ permissions: saved });
      }
      return NextResponse.json({ permissions: getDefaultPermissions(currentUser.role) });
    }

    // Admin-only: get all users with their permissions
    if (currentUser.role !== "admin") {
      return NextResponse.json({ error: "Admin access only" }, { status: 403 });
    }

    const allUsers = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        isActive: users.isActive,
      })
      .from(users)
      .orderBy(users.createdAt);

    const allPerms = await safeGetAllPerms();

    const permsMap = new Map<number, { permissions: Record<string, boolean>; updatedBy: string | null; updatedAt: string }>();
    for (const p of allPerms) {
      permsMap.set(p.userId, {
        permissions: p.permissions,
        updatedBy: p.updatedBy,
        updatedAt: p.updatedAt,
      });
    }

    const usersWithPerms = allUsers.map(u => {
      const saved = permsMap.get(u.id);
      return {
        ...u,
        permissions: saved?.permissions || getDefaultPermissions(u.role),
        permUpdatedBy: saved?.updatedBy || null,
        permUpdatedAt: saved?.updatedAt || null,
        isDefault: !saved,
      };
    });

    return NextResponse.json({ users: usersWithPerms, allTabs: ALL_TABS });
  } catch (error) {
    console.error("Permissions GET error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST - Update permissions for a user (admin only)
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getAuthUser();
    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ error: "Admin access only" }, { status: 403 });
    }

    const body = await request.json();
    const { userId, permissions } = body as {
      userId: number;
      permissions: Record<string, boolean>;
    };

    if (!userId || !permissions) {
      return NextResponse.json({ error: "userId and permissions required" }, { status: 400 });
    }

    // Ensure table exists
    await ensureTable();

    // Check if permission record exists
    const existing = await db
      .select({ id: userPermissions.id })
      .from(userPermissions)
      .where(eq(userPermissions.userId, userId))
      .limit(1);

    const now = new Date().toISOString();

    if (existing.length > 0) {
      await db
        .update(userPermissions)
        .set({
          permissions,
          updatedBy: currentUser.name,
          updatedAt: now,
        })
        .where(eq(userPermissions.userId, userId));
    } else {
      await db.insert(userPermissions).values({
        userId,
        permissions,
        updatedBy: currentUser.name,
        updatedAt: now,
        createdAt: now,
      });
    }

    // Get user name for activity log
    const targetUser = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const targetName = targetUser[0]?.name || `User #${userId}`;
    const enabledCount = Object.values(permissions).filter(Boolean).length;
    
    await logActivity(
      currentUser,
      "update_permissions",
      targetName,
      `Updated permissions (${enabledCount}/${Object.keys(permissions).length} tabs enabled)`
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Permissions POST error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PATCH - Reset permissions to role defaults (admin only)
export async function PATCH(request: NextRequest) {
  try {
    const currentUser = await getAuthUser();
    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ error: "Admin access only" }, { status: 403 });
    }

    const body = await request.json();
    const { userId } = body as { userId: number };

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    // Ensure table exists before deleting
    await ensureTable();

    // Delete custom permissions - will fall back to defaults
    await db
      .delete(userPermissions)
      .where(eq(userPermissions.userId, userId));

    // Get user info for defaults
    const targetUser = await db
      .select({ name: users.name, role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const targetName = targetUser[0]?.name || `User #${userId}`;
    const defaultPerms = getDefaultPermissions(targetUser[0]?.role || "employee");

    await logActivity(
      currentUser,
      "reset_permissions",
      targetName,
      `Reset permissions to ${targetUser[0]?.role || "employee"} defaults`
    );

    return NextResponse.json({ success: true, permissions: defaultPerms });
  } catch (error) {
    console.error("Permissions PATCH error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
