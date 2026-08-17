import { createHmac, timingSafeEqual } from "node:crypto";

type AdminAttemptState = {
  failures: number;
  windowStartedAt: number;
  lockedUntil: number;
};

const ADMIN_FAILURE_LIMIT = 5;
const ADMIN_WINDOW_MS = 15 * 60 * 1000;
const adminAttempts = new Map<string, AdminAttemptState>();

function constantTimeEqual(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  const paddedLength = Math.max(actualBuffer.length, expectedBuffer.length, 1);
  const paddedActual = Buffer.alloc(paddedLength);
  const paddedExpected = Buffer.alloc(paddedLength);
  actualBuffer.copy(paddedActual);
  expectedBuffer.copy(paddedExpected);

  return timingSafeEqual(paddedActual, paddedExpected) && actualBuffer.length === expectedBuffer.length;
}

export function getConfiguredAdminCredentials(): {
  username: string;
  password: string;
} | null {
  const username = process.env.INTERNAL_ADMIN_USERNAME?.trim();
  const password = process.env.INTERNAL_ADMIN_PASSWORD;
  if (!username || !password) return null;
  return { username, password };
}

export function verifyConfiguredAdminCredentials(
  username: string,
  password: string,
): boolean {
  const expected = getConfiguredAdminCredentials();
  if (!expected) return false;

  const usernameMatches = constantTimeEqual(username, expected.username);
  const passwordMatches = constantTimeEqual(password, expected.password);
  return usernameMatches && passwordMatches;
}

export function adminClientFingerprint(request: Request, secret: string): string {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address =
    forwardedFor ||
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    "unknown-address";
  const userAgent = request.headers.get("user-agent")?.slice(0, 256) || "unknown-agent";

  return createHmac("sha256", secret)
    .update(`${address}|${userAgent}`, "utf8")
    .digest("hex");
}

export function checkAdminLoginRateLimit(
  fingerprint: string,
  now = Date.now(),
): { allowed: boolean; retryAfterSeconds: number } {
  const state = adminAttempts.get(fingerprint);
  if (!state) return { allowed: true, retryAfterSeconds: 0 };

  if (state.lockedUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((state.lockedUntil - now) / 1000)),
    };
  }

  if (now - state.windowStartedAt >= ADMIN_WINDOW_MS) {
    adminAttempts.delete(fingerprint);
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export function recordAdminLoginResult(
  fingerprint: string,
  succeeded: boolean,
  now = Date.now(),
): void {
  if (succeeded) {
    adminAttempts.delete(fingerprint);
    return;
  }

  const previous = adminAttempts.get(fingerprint);
  const withinWindow = previous && now - previous.windowStartedAt < ADMIN_WINDOW_MS;
  const failures = withinWindow ? previous.failures + 1 : 1;
  const windowStartedAt = withinWindow ? previous.windowStartedAt : now;

  adminAttempts.set(fingerprint, {
    failures,
    windowStartedAt,
    lockedUntil: failures >= ADMIN_FAILURE_LIMIT ? now + ADMIN_WINDOW_MS : 0,
  });
}

export function resetAdminLoginRateLimitsForTests(): void {
  if (process.env.NODE_ENV === "test") adminAttempts.clear();
}
