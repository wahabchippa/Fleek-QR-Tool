import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { activityLogs } from "@/db/schema";
import { getAuthUser } from "@/lib/auth";
import { desc, like, or } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getAuthUser();
    if (!currentUser || !["admin", "manager"].includes(currentUser.role)) {
      return NextResponse.json({ error: "Admin/Manager only" }, { status: 403 });
    }

    const q = request.nextUrl.searchParams.get("q") || "";

    let logs;
    if (q.trim()) {
      const term = q.trim();
      logs = await db.select().from(activityLogs).where(
        or(
          like(activityLogs.userName, `%${term}%`),
          like(activityLogs.action, `%${term}%`),
          like(activityLogs.target, `%${term}%`),
          like(activityLogs.details, `%${term}%`)
        )
      ).orderBy(desc(activityLogs.id)).limit(500);
    } else {
      logs = await db.select().from(activityLogs).orderBy(desc(activityLogs.id)).limit(500);
    }

    return NextResponse.json({ logs });
  } catch (error) {
    console.error("Activity log error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
