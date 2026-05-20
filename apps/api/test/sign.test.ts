import cookie from "@fastify/cookie";
import fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppConfig } from "../src/config.js";
import { registerSignRoutes } from "../src/routes/sign.js";
import { SESSION_COOKIE } from "../src/routes/session.js";
import { encryptSigningCredential } from "../src/signing/credentials.js";

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

describe("sign routes", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("redirects legacy signing links to the web app", async () => {
    const app = await testApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: "/sign?owner=acme&repo=widget&pull=10&sha=abc123"
      });

      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toBe(
        "https://web.example.com/sign?owner=acme&repo=widget&pull=10&sha=abc123"
      );
    } finally {
      await app.close();
    }
  });

  it("requires authentication for signing data", async () => {
    const app = await testApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/sign?owner=acme&repo=widget"
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({ error: "Authentication required" });
    } finally {
      await app.close();
    }
  });

  it("returns the resolved CLA document as JSON", async () => {
    const app = await testApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/sign?owner=acme&repo=widget&pull=10&sha=abc123",
        headers: {
          cookie: `${SESSION_COOKIE}=${app.signCookie("sess_1")}`
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        user: {
          githubUserId: "100",
          login: "alice",
          avatarUrl: null
        },
        repository: {
          owner: "acme",
          name: "widget",
          fullName: "acme/widget"
        },
        cla: {
          documentId: "cla_1",
          title: "Managed CLA",
          body: "# Managed CLA\n\nPlease agree.",
          source: "managed_template"
        },
        context: {
          owner: "acme",
          repo: "widget",
          pull: "10",
          sha: "abc123"
        }
      });
    } finally {
      await app.close();
    }
  });

  it("sends Dropbox Sign template requests for Dropbox template documents", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const form = init.body as FormData;
      expect(form.get("template_ids[]")).toBe("tmpl_dropbox");
      expect(JSON.parse(String(form.get("signers")))[0]).toMatchObject({
        role: "Signer",
        name: "alice",
        email_address: "alice@example.com"
      });

      return Response.json({
        signature_request: {
          signature_request_id: "req_dropbox",
          signatures: [{ signature_id: "sig_dropbox" }]
        }
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const app = await testApp(fakeDropboxTemplateDb());

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/sign/personal",
        headers: {
          cookie: `${SESSION_COOKIE}=${app.signCookie("sess_1")}`,
          "content-type": "application/json"
        },
        payload: {
          owner: "acme",
          repo: "widget",
          pull: "10",
          sha: "abc123",
          claDocumentId: "cla_1",
          claVersionHash: "dropbox-hash",
          claTitle: "Dropbox CLA",
          signerEmail: "alice@example.com"
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        ok: true,
        dropboxSignEmailSent: true
      });
    } finally {
      await app.close();
    }
  });
});

async function testApp(db = fakeDb()) {
  const app = fastify({ logger: false });
  await app.register(cookie, { secret: config.SESSION_SECRET });
  await registerSignRoutes(app, {
    db,
    githubApp: {
      getInstallationOctokit: async () => ({
        request: async () => {
          throw new Error("Octokit should not be called for managed templates");
        }
      })
    } as any,
    config
  });
  await app.ready();
  return app;
}

function fakeDb() {
  return {
    query: {
      userSessions: {
        findFirst: async () => ({
          sessionId: "sess_1",
          githubUserId: "100",
          accessToken: "token",
          expiresAt: null
        })
      },
      githubUsers: {
        findFirst: async () => ({
          githubUserId: "100",
          login: "alice",
          avatarUrl: null
        })
      },
      repositories: {
        findFirst: async () => ({
          repositoryId: "repo_1",
          installationId: "200",
          owner: "acme",
          name: "widget",
          fullName: "acme/widget",
          defaultBranch: "main",
          private: false
        })
      },
      repositoryTemplateSettings: {
        findFirst: async () => ({
          repositoryId: "repo_1",
          mode: "managed",
          claTemplateVersionId: "ver_1"
        })
      },
      repositorySigningSettings: {
        findFirst: async () => null
      },
      signingProviderIntegrations: {
        findFirst: async () => null
      },
      claTemplateVersions: {
        findFirst: async () => ({
          claTemplateVersionId: "ver_1",
          claTemplateId: "tmpl_1",
          title: "Managed CLA",
          body: "# Managed CLA\n\nPlease agree.",
          contentFormat: "markdown",
          pdfData: null,
          pdfUrl: null,
          versionHash: "managed-hash"
        })
      },
      claTemplates: {
        findFirst: async () => ({
          claTemplateId: "tmpl_1",
          repositoryId: "repo_1",
          name: "Corporate template"
        })
      },
      claDocuments: {
        findFirst: async () => null
      }
    },
    insert: () => ({
      values: (values: Record<string, unknown>) => ({
        returning: async () => [
          {
            claDocumentId: "cla_1",
            repositoryId: "repo_1",
            source: values.source,
            templateName: values.templateName,
            versionHash: values.versionHash,
            body: values.body,
            contentFormat: values.contentFormat ?? "markdown",
            pdfUrl: values.pdfUrl ?? null,
            pdfData: values.pdfData ?? null,
            dropboxTemplateId: values.dropboxTemplateId ?? null,
            dropboxSignerRole: values.dropboxSignerRole ?? null
          }
        ]
      })
    })
  } as any;
}

function fakeDropboxTemplateDb() {
  const db = fakeDb();

  db.query.repositorySigningSettings.findFirst = async () => ({
    repositoryId: "repo_1",
    signingMode: "dropbox_sign",
    signingProviderIntegrationId: "signint_1"
  });
  db.query.signingProviderIntegrations.findFirst = async () => ({
    signingProviderIntegrationId: "signint_1",
    repositoryId: "repo_1",
    provider: "dropbox_sign",
    encryptedApiKey: encryptSigningCredential(config, "dropbox-key"),
    apiKeyLast4: "key"
  });
  db.query.claDocuments.findFirst = async () => ({
    claDocumentId: "cla_1",
    repositoryId: "repo_1",
    source: "managed_template",
    templateName: "Dropbox CLA",
    path: null,
    gitSha: null,
    versionHash: "dropbox-hash",
    body: "",
    contentFormat: "dropbox_template",
    pdfUrl: null,
    pdfData: null,
    dropboxTemplateId: "tmpl_dropbox",
    dropboxSignerRole: "Signer",
    createdAt: new Date(),
    updatedAt: new Date()
  });

  return db;
}
