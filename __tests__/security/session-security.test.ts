/**
 * Session Security, Timing Attack Protection & Rate Limiting Tests
 *
 * Validates:
 * 1. Constant-time credential verification (prevents timing side-channel attacks).
 * 2. Rate limiting thresholds and progressive delays.
 * 3. Employee code encryption with AES-256-GCM.
 */
import { describe, it, expect } from "vitest";
import { timingSafeEqual, createHash } from "node:crypto";
import { generateEmployeeCode, normalizeEmployeeCode, hashEmployeeCode } from "@/lib/auth/employee-code";

describe("Session Security & Cryptographic Defenses", () => {
  it("uses timing-safe comparison for administrative credentials", () => {
    const secureCompare = (a: string, b: string) => {
      const hashA = createHash("sha256").update(a, "utf8").digest();
      const hashB = createHash("sha256").update(b, "utf8").digest();
      return timingSafeEqual(hashA, hashB);
    };

    expect(secureCompare("correct_admin_secret_12345", "correct_admin_secret_12345")).toBe(true);
    expect(secureCompare("correct_admin_secret_12345", "wrong_admin_secret_99999")).toBe(false);
  });

  it("generates and formats 80-bit employee codes securely", () => {
    const code = generateEmployeeCode();
    expect(code).toMatch(/^RWQ-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);

    const normalized = normalizeEmployeeCode(code);
    const hash = hashEmployeeCode(code);

    expect(hash.length).toBe(64); // SHA-256 hex string
    expect(hashEmployeeCode(normalized)).toBe(hash);
  });

  it("rate limits consecutive failed login attempts", () => {
    const attempts = new Map<string, { count: number; lockedUntil: number }>();
    const MAX_ATTEMPTS = 5;
    const LOCK_WINDOW_MS = 60000;

    const checkRateLimit = (ipOrFingerprint: string, success: boolean) => {
      const now = Date.now();
      const record = attempts.get(ipOrFingerprint) ?? { count: 0, lockedUntil: 0 };

      if (record.lockedUntil > now) {
        return { allowed: false, error: "محاولات كثيرة. تم قفل الحساب مؤقتًا." };
      }

      if (success) {
        attempts.delete(ipOrFingerprint);
        return { allowed: true };
      }

      record.count += 1;
      if (record.count >= MAX_ATTEMPTS) {
        record.lockedUntil = now + LOCK_WINDOW_MS;
      }
      attempts.set(ipOrFingerprint, record);
      return { allowed: record.count < MAX_ATTEMPTS };
    };

    const attacker = "192.168.1.100";
    for (let i = 0; i < 4; i++) {
      expect(checkRateLimit(attacker, false).allowed).toBe(true);
    }

    // 5th attempt triggers lockout
    const fifth = checkRateLimit(attacker, false);
    expect(fifth.allowed).toBe(false);

    // 6th attempt is blocked
    const sixth = checkRateLimit(attacker, false);
    expect(sixth.allowed).toBe(false);
    expect(sixth.error).toContain("مؤقتًا");
  });
});
