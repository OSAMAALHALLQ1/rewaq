import { SignJWT, jwtVerify } from "jose";

export const ADMIN_SESSION_ISSUER = "rewaq-admin";
export const ADMIN_SESSION_AUDIENCE = "rewaq-internal-admin";

export type AdminSessionClaims = {
  role: "super_admin";
  username: string;
};

function getAdminSigningKey(): Uint8Array {
  const secret = process.env.INTERNAL_ADMIN_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("INTERNAL_ADMIN_SECRET must contain at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

export async function signAdminSessionToken(username: string): Promise<string> {
  return new SignJWT({ role: "super_admin", username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ADMIN_SESSION_ISSUER)
    .setAudience(ADMIN_SESSION_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getAdminSigningKey());
}

export async function verifyAdminSessionToken(
  token: string,
): Promise<AdminSessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getAdminSigningKey(), {
      algorithms: ["HS256"],
      issuer: ADMIN_SESSION_ISSUER,
      audience: ADMIN_SESSION_AUDIENCE,
    });
    if (payload.role !== "super_admin" || typeof payload.username !== "string") {
      return null;
    }
    return { role: "super_admin", username: payload.username };
  } catch {
    return null;
  }
}
