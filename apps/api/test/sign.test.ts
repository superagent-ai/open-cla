import cookie from "@fastify/cookie";
import fastify from "fastify";
import { describe, expect, it } from "vitest";
import type { AppConfig } from "../src/config.js";
import { registerSignRoutes } from "../src/routes/sign.js";
import { SESSION_COOKIE } from "../src/routes/session.js";

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
  DEFAULT_CLA_TEMPLATE_NAME: "standard-combined-v1"
};

describe("sign routes", () => {
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
});

async function testApp() {
  const app = fastify({ logger: false });
  await app.register(cookie, { secret: config.SESSION_SECRET });
  await registerSignRoutes(app, {
    db: fakeDb(),
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
            body: values.body
          }
        ]
      })
    })
  } as any;
}
