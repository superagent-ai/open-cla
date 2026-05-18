import dns from "node:dns/promises";
import { isIP } from "node:net";

import type { AppConfig } from "../config.js";
import { getConfig } from "../config.js";

const ALLOWED_EXTERNAL_HOST_SUFFIXES = [
  "utfs.io",
  "ufs.sh",
  "uploadthing.com",
  "uploadthing.dev",
  "uploadthing-prod.s3.amazonaws.com"
] as const;

export async function assertSafePdfFetchUrl(
  urlString: string,
  config: AppConfig = getConfig()
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new Error("Invalid PDF URL");
  }

  if (url.username || url.password) {
    throw new Error("PDF URL must not include credentials");
  }

  const hostname = url.hostname.toLowerCase();
  const isAppHost = getTrustedAppHostnames(config).includes(hostname);
  const isAllowedExternal = ALLOWED_EXTERNAL_HOST_SUFFIXES.some(
    (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`)
  );

  if (!isAppHost && !isAllowedExternal) {
    throw new Error("PDF URL host is not allowed");
  }

  if (url.protocol === "https:") {
    await assertResolvesToPublicAddresses(hostname);
    return url;
  }

  if (
    isAppHost &&
    config.NODE_ENV === "development" &&
    url.protocol === "http:" &&
    (hostname === "localhost" || hostname === "127.0.0.1")
  ) {
    await assertResolvesToPublicAddresses(hostname);
    return url;
  }

  throw new Error("PDF URL must use HTTPS");
}

function getTrustedAppHostnames(config: AppConfig): string[] {
  return [config.ADMIN_WEB_URL, config.PUBLIC_APP_URL].map((value) => new URL(value).hostname.toLowerCase());
}

async function assertResolvesToPublicAddresses(hostname: string): Promise<void> {
  if (isIP(hostname)) {
    if (isPrivateOrRestrictedIp(hostname)) {
      throw new Error("PDF URL resolves to a private address");
    }
    return;
  }

  const addresses = await dns.lookup(hostname, { all: true });
  if (addresses.length === 0) {
    throw new Error("PDF URL host could not be resolved");
  }

  for (const { address } of addresses) {
    if (isPrivateOrRestrictedIp(address)) {
      throw new Error("PDF URL resolves to a private address");
    }
  }
}

function isPrivateOrRestrictedIp(ip: string): boolean {
  if (ip.includes(":")) {
    const normalized = ip.toLowerCase();
    if (normalized === "::1") {
      return true;
    }
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) {
      return true;
    }
    if (normalized.startsWith("fe80")) {
      return true;
    }
    return false;
  }

  const parts = ip.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return true;
  }

  const a = parts[0]!;
  const b = parts[1]!;
  const c = parts[2]!;
  const d = parts[3]!;
  if (a === 10 || a === 127 || a === 0) {
    return true;
  }
  if (a === 169 && b === 254) {
    return true;
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  if (a === 192 && b === 168) {
    return true;
  }
  if (a === 100 && b >= 64 && b <= 127) {
    return true;
  }
  if (a >= 224) {
    return true;
  }
  if (a === 198 && (b === 18 || b === 19)) {
    return true;
  }
  if (a === 192 && b === 0 && c === 2) {
    return true;
  }

  return d === 0 || d === 255;
}
