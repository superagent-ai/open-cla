import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createDropboxSigningRequestFromTemplate,
  getDropboxTemplate
} from "../src/signing/dropboxSign.js";
import type { AppConfig } from "../src/config.js";

const config: AppConfig = {
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

describe("Dropbox Sign template API", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads template signer roles", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          template: {
            template_id: "tmpl_dropbox",
            title: "Dropbox CLA",
            signer_roles: [{ name: "Signer" }, { name: "Approver" }]
          }
        })
      )
    );

    await expect(getDropboxTemplate({ apiKey: "key" }, "tmpl_dropbox")).resolves.toEqual({
      templateId: "tmpl_dropbox",
      title: "Dropbox CLA",
      signerRoles: ["Signer", "Approver"]
    });
  });

  it("sends a signature request with a template and signer role", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const form = init.body as FormData;

      expect(form.get("template_ids[]")).toBe("tmpl_dropbox");
      expect(form.get("custom_fields")).toBeNull();
      expect(JSON.parse(String(form.get("signers")))).toEqual([
        {
          role: "Signer",
          name: "alice",
          email_address: "alice@example.com"
        }
      ]);

      return Response.json({
        signature_request: {
          signature_request_id: "req_1",
          signatures: [{ signature_id: "sig_1" }]
        }
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createDropboxSigningRequestFromTemplate({
        config,
        credentials: { apiKey: "key" },
        templateId: "tmpl_dropbox",
        signerRole: "Signer",
        signerName: "alice",
        signerEmail: "alice@example.com",
        repositoryFullName: "acme/widget",
        kind: "personal",
        signingRedirectUrl: "https://github.com/acme/widget/pull/1"
      })
    ).resolves.toEqual({
      providerRequestId: "req_1",
      providerSignatureId: "sig_1"
    });
  });
});
