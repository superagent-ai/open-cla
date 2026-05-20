import { describe, expect, it } from "vitest";
import type { AppConfig } from "../src/config.js";
import { resolveDropboxApiKey } from "../src/signing/userCredentials.js";

const testConfig: AppConfig = {
  NODE_ENV: "test",
  PORT: 3000,
  PUBLIC_APP_URL: "https://api.example.com",
  ADMIN_WEB_URL: "https://web.example.com",
  DATABASE_URL: "postgres://example",
  GITHUB_APP_ID: 1,
  GITHUB_APP_PRIVATE_KEY: "private-key",
  GITHUB_WEBHOOK_SECRET: "secret",
  GITHUB_CLIENT_ID: "client-id",
  GITHUB_CLIENT_SECRET: "client-secret",
  SESSION_SECRET: "test-secret-that-is-at-least-32-bytes",
  GITHUB_OAUTH_SCOPES: "read:org",
  DEFAULT_CLA_TEMPLATE_NAME: "standard-combined-v1"
};

describe("user Dropbox credentials", () => {
  it("prefers a provided key over stored credentials", async () => {
    const db = {
      query: {
        userSigningProviderCredentials: {
          findFirst: async () => null
        }
      }
    };

    const key = await resolveDropboxApiKey(db as never, testConfig, "100", "provided-key");
    expect(key).toBe("provided-key");
  });
});
