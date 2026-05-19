import cookie from "@fastify/cookie";
import fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppConfig } from "../src/config.js";
import { registerAdminRoutes } from "../src/routes/admin.js";
import { SESSION_COOKIE } from "../src/routes/session.js";

vi.mock("../src/github/user.js", () => ({
  hasRepositoryAdminPermission: vi.fn()
}));

import { hasRepositoryAdminPermission } from "../src/github/user.js";

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

describe("admin routes", () => {
  afterEach(() => {
    vi.mocked(hasRepositoryAdminPermission).mockReset();
  });

  it("requires authentication for installations", async () => {
    const app = await testApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/admin/installations"
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({ error: "Authentication required" });
    } finally {
      await app.close();
    }
  });

  it("returns only repositories the user can administer", async () => {
    vi.mocked(hasRepositoryAdminPermission)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    const app = await testApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/admin/installations",
        headers: {
          cookie: `${SESSION_COOKIE}=${app.signCookie("sess_1")}`
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        installations: [
          {
            installationId: "200",
            accountId: "300",
            accountLogin: "acme",
            accountType: "Organization",
            repositories: [
              {
                repositoryId: "repo_1",
                installationId: "200",
                owner: "acme",
                name: "widget",
                fullName: "acme/widget",
                private: false,
                defaultBranch: "main",
                adminPermission: true,
                stats: {
                  templateMode: "repository",
                  signingMode: "simple",
                  selectedTemplateName: null,
                  signatureCount: 0,
                  pullRequestCheckCount: 0,
                  lastActivityAt: null
                }
              }
            ]
          }
        ]
      });
    } finally {
      await app.close();
    }
  });

  it("requires repository admin permission for repository routes", async () => {
    vi.mocked(hasRepositoryAdminPermission).mockResolvedValue(false);

    const app = await testApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/admin/repositories/repo_1/templates",
        headers: {
          cookie: `${SESSION_COOKIE}=${app.signCookie("sess_1")}`
        }
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({ error: "Repository admin permission required" });
    } finally {
      await app.close();
    }
  });

  it("allows repository routes when the user has admin permission", async () => {
    vi.mocked(hasRepositoryAdminPermission).mockResolvedValue(true);

    const app = await testApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/admin/repositories/repo_1/templates",
        headers: {
          cookie: `${SESSION_COOKIE}=${app.signCookie("sess_1")}`
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        repository: {
          repositoryId: "repo_1",
          fullName: "acme/widget",
          adminPermission: true
        }
      });
    } finally {
      await app.close();
    }
  });

  it("scopes global templates to the signed-in user in repository policy options", async () => {
    vi.mocked(hasRepositoryAdminPermission).mockResolvedValue(true);

    const app = await testApp(fakeDbWithTemplates());

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/admin/repositories/repo_1/templates",
        headers: {
          cookie: `${SESSION_COOKIE}=${app.signCookie("sess_1")}`
        }
      });

      expect(response.statusCode).toBe(200);
      const templateNames = response
        .json()
        .templates.filter((template: { source: string; repositoryId: string | null }) => {
          return template.source === "uploaded" && template.repositoryId === null;
        })
        .map((template: { name: string }) => template.name);

      expect(templateNames).toEqual(["Mine"]);
    } finally {
      await app.close();
    }
  });

  it("rejects selecting another user's global template", async () => {
    vi.mocked(hasRepositoryAdminPermission).mockResolvedValue(true);

    const app = await testApp(fakeDbWithForeignTemplateSelection());

    try {
      const response = await app.inject({
        method: "PUT",
        url: "/api/admin/repositories/repo_1/template-selection",
        headers: {
          cookie: `${SESSION_COOKIE}=${app.signCookie("sess_1")}`,
          "content-type": "application/json"
        },
        payload: {
          templateVersionId: "tmplver_other"
        }
      });

      expect(response.statusCode).toBe(500);
    } finally {
      await app.close();
    }
  });

  it("returns only signers from repositories the user can administer", async () => {
    vi.mocked(hasRepositoryAdminPermission).mockResolvedValue(true);

    const app = await testApp(fakeDbWithScopedUsers());

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/admin/users",
        headers: {
          cookie: `${SESSION_COOKIE}=${app.signCookie("sess_1")}`
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        users: [
          {
            githubUserId: "200",
            login: "signer",
            avatarUrl: null,
            signatureCount: 1
          }
        ]
      });
    } finally {
      await app.close();
    }
  });
});

async function testApp(db = fakeDb()) {
  const app = fastify({ logger: false });
  await app.register(cookie, { secret: config.SESSION_SECRET });
  await registerAdminRoutes(app, {
    db,
    config
  });
  await app.ready();
  return app;
}

function fakeDbWithTemplates() {
  let globalTemplateQueryCount = 0;
  const db = fakeDb();

  db.query.claTemplates.findMany = async () => {
    globalTemplateQueryCount += 1;
    if (globalTemplateQueryCount === 1) {
      return [];
    }

    return [
      {
        claTemplateId: "tmpl_mine",
        repositoryId: null,
        source: "uploaded",
        name: "Mine",
        description: null,
        createdByGithubUserId: "100",
        createdByLogin: "alice",
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
  };

  return db;
}

function fakeDbWithForeignTemplateSelection() {
  const db = fakeDb();

  db.query.claTemplateVersions.findFirst = async () => ({
    claTemplateVersionId: "tmplver_other",
    claTemplateId: "tmpl_other",
    title: "Other",
    body: "body",
    versionHash: "hash",
    contentFormat: "markdown",
    pdfUrl: null,
    pdfFileName: null,
    createdByGithubUserId: "999",
    createdByLogin: "bob",
    createdAt: new Date(),
    updatedAt: new Date()
  });

  db.query.claTemplates.findFirst = async () => ({
    claTemplateId: "tmpl_other",
    repositoryId: null,
    source: "uploaded",
    name: "Other",
    description: null,
    createdByGithubUserId: "999",
    createdByLogin: "bob",
    createdAt: new Date(),
    updatedAt: new Date()
  });

  return db;
}

function fakeDbWithScopedUsers() {
  const db = fakeDb();

  db.query.claDocuments.findMany = async () => [
    {
      claDocumentId: "cla_1",
      repositoryId: "repo_1"
    }
  ];
  db.query.personalSignatures.findMany = async () => [
    {
      githubUserId: "200",
      claDocumentId: "cla_1"
    }
  ];
  db.query.githubUsers.findMany = async () => [
    {
      githubUserId: "200",
      login: "signer",
      avatarUrl: null
    }
  ];

  return db;
}

function fakeDb() {
  let templateCounter = 0;

  return {
    insert: () => ({
      values: (payload: Record<string, unknown>) => ({
        returning: async () => {
          if ("name" in payload) {
            templateCounter += 1;
            return [
              {
                claTemplateId: `tmpl_${templateCounter}`,
                repositoryId: payload.repositoryId ?? null,
                source: payload.source ?? "default",
                name: payload.name,
                description: payload.description ?? "desc",
                createdAt: new Date(),
                updatedAt: new Date(),
                createdByGithubUserId: null
              }
            ];
          }

          return [
            {
              claTemplateVersionId: `tmplver_${templateCounter}`,
              claTemplateId: payload.claTemplateId,
              title: payload.title ?? "Title",
              body: payload.body ?? "body",
              versionHash: payload.versionHash ?? "hash",
              contentFormat: "markdown",
              pdfUrl: null,
              pdfFileName: null,
              createdByGithubUserId: null,
              createdByLogin: null,
              createdAt: new Date(),
              updatedAt: new Date()
            }
          ];
        }
      })
    }),
    update: () => ({
      set: () => ({
        where: async () => undefined
      })
    }),
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
      installations: {
        findMany: async () => [
          {
            installationId: "200",
            accountId: "300",
            accountLogin: "acme",
            accountType: "Organization"
          }
        ],
        findFirst: async () => ({
          installationId: "200",
          accountId: "300",
          accountLogin: "acme",
          accountType: "Organization"
        })
      },
      repositories: {
        findMany: async () => [
          {
            repositoryId: "repo_1",
            installationId: "200",
            owner: "acme",
            name: "widget",
            fullName: "acme/widget",
            defaultBranch: "main",
            private: false
          },
          {
            repositoryId: "repo_2",
            installationId: "200",
            owner: "acme",
            name: "secret",
            fullName: "acme/secret",
            defaultBranch: "main",
            private: true
          }
        ],
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
      claTemplates: {
        findMany: async () => [],
        findFirst: async () => null
      },
      claTemplateVersions: {
        findMany: async () => [],
        findFirst: async () => null
      },
      claDocuments: {
        findMany: async () => []
      },
      repositoryTemplateSettings: {
        findFirst: async () => null
      },
      repositorySigningSettings: {
        findFirst: async () => null
      },
      personalSignatures: {
        findMany: async () => []
      },
      corporateAgreements: {
        findMany: async () => []
      },
      pullRequestChecks: {
        findMany: async () => []
      },
      signingProviderIntegrations: {
        findFirst: async () => null
      }
    }
  } as any;
}
