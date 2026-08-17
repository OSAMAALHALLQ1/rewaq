import { describe, expect, it } from "vitest";
import {
  employeeCodeHint,
  fingerprintEmployeeLoginClient,
  generateEmployeeCode,
  hashEmployeeCode,
  normalizeEmployeeCode,
} from "@/lib/auth/employee-code";

describe("employee login codes", () => {
  it("generates long, unambiguous, high-entropy codes", () => {
    const codes = new Set(Array.from({ length: 200 }, generateEmployeeCode));

    expect(codes.size).toBe(200);
    for (const code of codes) {
      expect(code).toMatch(/^RWQ-[2-9A-HJ-NP-Z]{4}(?:-[2-9A-HJ-NP-Z]{4}){3}$/);
      expect(code).toHaveLength(23);
    }
  });

  it("normalizes before hashing so casing and whitespace do not change identity", () => {
    const code = "rwq-7kmp-3xhf-9qtr-6wyz";
    expect(normalizeEmployeeCode(` ${code} `)).toBe(
      "RWQ-7KMP-3XHF-9QTR-6WYZ",
    );
    expect(hashEmployeeCode(code)).toBe(
      hashEmployeeCode(" RWQ-7KMP-3XHF-9QTR-6WYZ "),
    );
    expect(hashEmployeeCode(code)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("does not persist a raw client address or employee code in audit hints", () => {
    const fingerprint = fingerprintEmployeeLoginClient(
      "203.0.113.10|browser",
      "test-secret",
    );
    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(fingerprint).not.toContain("203.0.113.10");
    expect(employeeCodeHint("RWQ-7KMP-3XHF-9QTR-6WYZ")).toBe("****6WYZ");
  });
});
