import { SignJWT, jwtVerify } from "jose";

/**
 * Signed 8-hour trial ticket for the demo session. The cookie proves when the
 * trial started; the proxy rejects demo sessions whose ticket is missing,
 * invalid, or expired, so the free trial cannot outlive its window.
 */
export const DEMO_TRIAL_COOKIE = "rwq_demo_trial";
export const DEMO_TRIAL_HOURS = 8;

function trialSecret(): Uint8Array | null {
  const secret = process.env.INTERNAL_ADMIN_SECRET;
  return secret ? new TextEncoder().encode(secret) : null;
}

export async function createDemoTrialToken(): Promise<string | null> {
  const secret = trialSecret();
  if (!secret) return null;

  return new SignJWT({ purpose: "demo-trial" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DEMO_TRIAL_HOURS}h`)
    .sign(secret);
}

export async function isDemoTrialTokenValid(token: string | undefined): Promise<boolean> {
  const secret = trialSecret();
  // Without a configured secret the ticket cannot be verified; the trial
  // window is then unenforced (demo data isolation still applies).
  if (!secret) return true;
  if (!token) return false;

  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    return payload.purpose === "demo-trial";
  } catch {
    return false;
  }
}
