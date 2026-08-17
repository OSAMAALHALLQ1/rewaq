import { createHash, createHmac, randomInt } from "node:crypto";

const EMPLOYEE_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const EMPLOYEE_CODE_CHUNK_LENGTH = 4;
const EMPLOYEE_CODE_CHUNKS = 4;

export const EMPLOYEE_CODE_PREFIX = "RWQ";
export const EMPLOYEE_CODE_EXAMPLE = "RWQ-7KMP-3XHF-9QTR-6WYZ";

export function normalizeEmployeeCode(value: string): string {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

/** Generates an 80-bit employee credential using an unambiguous alphabet. */
export function generateEmployeeCode(): string {
  const characters = Array.from(
    { length: EMPLOYEE_CODE_CHUNK_LENGTH * EMPLOYEE_CODE_CHUNKS },
    () => EMPLOYEE_CODE_ALPHABET[randomInt(EMPLOYEE_CODE_ALPHABET.length)],
  );
  const chunks = Array.from({ length: EMPLOYEE_CODE_CHUNKS }, (_, index) =>
    characters
      .slice(
        index * EMPLOYEE_CODE_CHUNK_LENGTH,
        (index + 1) * EMPLOYEE_CODE_CHUNK_LENGTH,
      )
      .join(""),
  );

  return `${EMPLOYEE_CODE_PREFIX}-${chunks.join("-")}`;
}

/**
 * The database stores only this fingerprint. Existing short codes are hashed
 * by migration 057, so they continue to work without retaining plaintext.
 */
export function hashEmployeeCode(value: string): string {
  return createHash("sha256")
    .update(normalizeEmployeeCode(value), "utf8")
    .digest("hex");
}

export function fingerprintEmployeeLoginClient(
  value: string,
  secret: string,
): string {
  return createHmac("sha256", secret)
    .update(value || "unknown-client", "utf8")
    .digest("hex");
}

export function employeeCodeHint(value: string): string {
  const normalized = normalizeEmployeeCode(value);
  return normalized.length <= 4 ? "****" : `****${normalized.slice(-4)}`;
}
