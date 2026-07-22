import { db } from "@/db";
import { activityLogs } from "@/db/schema";

export async function logActivity(
  user: { id: number; name: string; role: string },
  action: string,
  target: string,
  details?: string
) {
  try {
    await db.insert(activityLogs).values({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action,
      target,
      details: details || null,
    });
  } catch (err) {
    console.error("Activity log error:", err);
  }
}
