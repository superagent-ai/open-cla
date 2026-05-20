import { describe, expect, it } from "vitest";

import type { AppConfig } from "../src/config.js";
import { assertSafePdfFetchUrl } from "../src/signing/safePdfFetchUrl.js";

const testConfig: AppConfig = {
  NODE_ENV: "test",
  PORT: 3000,
  PUBLIC_APP_URL: "http://localhost:3000",
  ADMIN_WEB_URL: "http://localhost:3001",
  DATABASE_URL: "postgres://example",
  GITHUB_APP_ID: 1,
  GITHUB_APP_PRIVATE_KEY: "test-key",
  GITHUB_WEBHOOK_SECRET: "test-secret",
  GITHUB_CLIENT_ID: "client",
  GITHUB_CLIENT_SECRET: "secret",
  SESSION_SECRET: "01234567890123456789012345678901",
  GITHUB_OAUTH_SCOPES: "read:org",
  DEFAULT_CLA_TEMPLATE_NAME: "standard-combined-v1"
};

describe("assertSafePdfFetchUrl", () => {
  it("allows trusted upload hosts over https", async () => {
    const url = await assertSafePdfFetchUrl("https://utfs.io/f/example.pdf", testConfig);
    expect(url.hostname).toBe("utfs.io");
  });

  it("rejects non-https external hosts", async () => {
    await expect(assertSafePdfFetchUrl("http://utfs.io/f/example.pdf", testConfig)).rejects.toThrow(
      "PDF URL must use HTTPS"
    );
  });

  it("rejects private IP literals", async () => {
    await expect(assertSafePdfFetchUrl("https://127.0.0.1/file.pdf", testConfig)).rejects.toThrow(
      /private address|host is not allowed/
    );
  });

  it("rejects unknown hosts", async () => {
    await expect(assertSafePdfFetchUrl("https://evil.example/file.pdf", testConfig)).rejects.toThrow(
      "host is not allowed"
    );
  });

  it("rejects credentials in the URL", async () => {
    await expect(
      assertSafePdfFetchUrl("https://user:pass@utfs.io/f/example.pdf", testConfig)
    ).rejects.toThrow("must not include credentials");
  });
});
