import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const SECRET_KEY = process.env.ENCRYPTION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "default_encryption_secret_must_be_32_bytes_long!!!";

// Derives a 32-byte key from the secret key using SHA-256
const key = crypto.createHash("sha256").update(SECRET_KEY).digest();

/**
 * Encrypts plain text using AES-256-GCM
 * @param text The plain text to encrypt
 * @returns Encrypted string formatted as iv:authTag:encryptedText
 */
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypts an encrypted string formatted as iv:authTag:encryptedText
 * @param encryptedText The encrypted text
 * @returns Decrypted plain text
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) return "";
  
  const parts = encryptedText.split(":");
  if (parts.length !== 3) {
    // If it's not encrypted (e.g. legacy/mock data), return it as is
    return encryptedText;
  }
  
  try {
    const iv = Buffer.from(parts[0], "hex");
    const authTag = Buffer.from(parts[1], "hex");
    const encrypted = parts[2];
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (error) {
    console.error("Failed to decrypt token:", error);
    // Fallback for unencrypted keys or mismatched secret keys
    return encryptedText;
  }
}
