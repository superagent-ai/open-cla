import { createHash } from "node:crypto";

export function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export function sha256Bytes(input: Buffer | Uint8Array): string {
  return createHash("sha256").update(input).digest("hex");
}
