import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { AppConfig } from "../config.js";

const ALGORITHM = "aes-256-gcm";

export function encryptSigningCredential(config: AppConfig, value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(config), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptSigningCredential(config: AppConfig, encryptedValue: string): string {
  const [ivValue, tagValue, encrypted] = encryptedValue.split(".");
  if (!ivValue || !tagValue || !encrypted) {
    throw new Error("Invalid encrypted signing credential");
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    encryptionKey(config),
    Buffer.from(ivValue, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64url")),
    decipher.final()
  ]).toString("utf8");
}

function encryptionKey(config: AppConfig): Buffer {
  return createHash("sha256")
    .update(config.SIGNING_CREDENTIAL_ENCRYPTION_KEY ?? config.SESSION_SECRET, "utf8")
    .digest();
}
