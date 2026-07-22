import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { getAuthUser } from "@/lib/auth";
import { desc, sql } from "drizzle-orm";
import { pool } from "@/db";

// Ensure notifications table exists
async function ensureTable(): Promise<boolean> {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        icon TEXT DEFAULT 'bell',
        link TEXT,
        target_roles TEXT,
        read_by TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT ''
      );
    `);
    return true;
  } catch (err) {
    console.error("Could not ensure notifications table:", err);
    return false;
  }
}

// GET - Get notifications for current user
export async function GET() {
  try {
    const currentUser = await getAuthUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    await ensureTable();

    // Get last 50 notifications
    const allNotifs = await db
      .select()
      .from(notifications)
      .orderBy(desc(notifications.createdAt))
      .limit(50);

    // Filter by target roles and add read status
    const userNotifs = allNotifs
      .filter(n => {
        if (!n.targetRoles) return true; // null = all users
        const roles = n.targetRoles.split(",").map(r => r.trim());
        return roles.includes(currentUser.role) || roles.includes("all");
      })
      .map(n => ({
        ...n,
        isRead: n.readBy?.split(",").includes(String(currentUser.id)) || false,
      }));

    const unreadCount = userNotifs.filter(n => !n.isRead).length;

    return NextResponse.json({ 
      notifications: userNotifs.slice(0, 20), // Return max 20
      unreadCount 
    });
  } catch (error) {
    console.error("Notifications GET error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST - Create a notification (internal use or admin)
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getAuthUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Only admin/manager can create notifications manually
    if (!["admin", "manager"].includes(currentUser.role)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    await ensureTable();

    const body = await request.json();
    const { type, title, message, icon, link, targetRoles } = body;

    if (!type || !title || !message) {
      return NextResponse.json({ error: "type, title, message required" }, { status: 400 });
    }

    await db.insert(notifications).values({
      type,
      title,
      message,
      icon: icon || "bell",
      link: link || null,
      targetRoles: targetRoles || null,
      readBy: "",
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Notifications POST error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PATCH - Mark notification(s) as read
export async function PATCH(request: NextRequest) {
  try {
    const currentUser = await getAuthUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { notificationIds, markAllRead } = body as { notificationIds?: number[]; markAllRead?: boolean };

    await ensureTable();

    const userId = String(currentUser.id);

    if (markAllRead) {
      // Mark all as read for this user
      const allNotifs = await db.select().from(notifications).limit(100);
      for (const n of allNotifs) {
        const readList = n.readBy ? n.readBy.split(",").filter(Boolean) : [];
        if (!readList.includes(userId)) {
          readList.push(userId);
          await pool.query(
            "UPDATE notifications SET read_by = $1 WHERE id = $2",
            [readList.join(","), n.id]
          );
        }
      }
    } else if (notificationIds && notificationIds.length > 0) {
      // Mark specific notifications as read
      for (const nid of notificationIds) {
        const result = await db.select().from(notifications).where(sql`${notifications.id} = ${nid}`).limit(1);
        if (result.length > 0) {
          const n = result[0];
          const readList = n.readBy ? n.readBy.split(",").filter(Boolean) : [];
          if (!readList.includes(userId)) {
            readList.push(userId);
            await pool.query(
              "UPDATE notifications SET read_by = $1 WHERE id = $2",
              [readList.join(","), n.id]
            );
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Notifications PATCH error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// Helper function to create notification (used by other APIs)
export async function createNotification(
  type: string,
  title: string,
  message: string,
  options?: { icon?: string; link?: string; targetRoles?: string }
) {
  try {
    await ensureTable();
    await db.insert(notifications).values({
      type,
      title,
      message,
      icon: options?.icon || "bell",
      link: options?.link || null,
      targetRoles: options?.targetRoles || null,
      readBy: "",
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Failed to create notification:", err);
  }
}
