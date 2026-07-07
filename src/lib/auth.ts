import crypto from "crypto";
import { cookies } from "next/headers";

// Fixed secret — no environment variables needed
const AUTH_SECRET = "fleekvault-permanent-auth-secret-key-2024";
const SALT = "fleekvault-permanent-salt-2024";

export function hashPassword(password: string): string {
  return crypto
    .createHash("sha256")
    .update(password + SALT)
    .digest("hex");
}

export function createSessionToken(user: {
  id: number;
  email: string;
  name: string;
  role: string;
}): string {
  const payload = JSON.stringify({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
  });
  const signature = crypto
    .createHmac("sha256", AUTH_SECRET)
    .update(payload)
    .digest("hex");
  return Buffer.from(
    JSON.stringify({ data: payload, signature })
  ).toString("base64");
}

export function verifySessionToken(
  token: string
): { id: number; email: string; name: string; role: string } | null {
  try {
    const decoded = JSON.parse(Buffer.from(token, "base64").toString());
    const expectedSig = crypto
      .createHmac("sha256", AUTH_SECRET)
      .update(decoded.data)
      .digest("hex");
    if (expectedSig !== decoded.signature) return null;
    const payload = JSON.parse(decoded.data);
    if (payload.exp && payload.exp < Date.now()) return null;
    return { id: payload.id, email: payload.email, name: payload.name, role: payload.role };
  } catch { return null; }
}

export async function getAuthUser(): Promise<{
  id: number; email: string; name: string; role: string;
} | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return null;
    return verifySessionToken(token);
  } catch { return null; }
}
