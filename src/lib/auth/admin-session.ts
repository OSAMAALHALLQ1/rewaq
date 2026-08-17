import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  signAdminSessionToken,
  verifyAdminSessionToken,
  type AdminSessionClaims,
} from "@/lib/auth/admin-token";

const ADMIN_SESSION_COOKIE = "admin_session";

export type AdminSession = AdminSessionClaims;

export async function createAdminSession(username: string) {
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const session = await signAdminSessionToken(username);

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    expires,
    path: "/",
  });
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (!session) return null;

  return verifyAdminSessionToken(session);
}

export async function requireAdminSession(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin-login");
  }
  return session;
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
  redirect("/admin-login");
}
