import { describe, expect, it } from "vitest";
import { resolveClaForRepository } from "../src/cla/resolveCla.js";

describe("resolveClaForRepository", () => {
  it("uses the managed repository template before reading CLA.md", async () => {
    const result = await resolveClaForRepository({
      db: fakeDb({
        settings: {
          mode: "managed",
          claTemplateVersionId: "ver_1"
        },
        template: {
          claTemplateId: "tmpl_1",
          repositoryId: "100",
          name: "Admin template"
        },
        version: {
          claTemplateVersionId: "ver_1",
          claTemplateId: "tmpl_1",
          title: "Admin CLA",
          body: "# Managed CLA"
        }
      }),
      octokit: fakeOctokitThatShouldNotBeCalled(),
      owner: "owner",
      repo: "repo",
      repositoryId: "100",
      defaultTemplateName: "standard-combined-v1"
    });

    expect(result.source).toBe("managed_template");
    expect(result.title).toBe("Admin CLA");
    expect(result.body).toBe("# Managed CLA");
  });

  it("uses a repository CLA.md when present", async () => {
    const body = "# Custom CLA";
    const result = await resolveClaForRepository({
      db: fakeDb(),
      octokit: fakeOctokitWithCla(body),
      owner: "owner",
      repo: "repo",
      repositoryId: "100",
      defaultTemplateName: "standard-combined-v1"
    });

    expect(result.source).toBe("repository");
    expect(result.body).toBe(body);
    expect(result.document.gitSha).toBe("abc123");
  });

  it("falls back to the configured default template", async () => {
    const result = await resolveClaForRepository({
      db: fakeDb(),
      octokit: fakeOctokitMissingCla(),
      owner: "owner",
      repo: "repo",
      repositoryId: "100",
      defaultTemplateName: "standard-combined-v1"
    });

    expect(result.source).toBe("default_template");
    expect(result.body).toContain("Contributor License Agreement");
    expect(result.versionHash).toHaveLength(64);
  });
});

function fakeDb(options: {
  settings?: Record<string, unknown> | null;
  template?: Record<string, unknown> | null;
  version?: Record<string, unknown> | null;
} = {}) {
  return {
    query: {
      repositoryTemplateSettings: {
        findFirst: async () => options.settings ?? null
      },
      claTemplateVersions: {
        findFirst: async () =>
          options.version
            ? {
                createdAt: new Date(),
                updatedAt: new Date(),
                versionHash: "managed-hash",
                createdByLogin: null,
                ...options.version
              }
            : null
      },
      claTemplates: {
        findFirst: async () =>
          options.template
            ? {
                createdAt: new Date(),
                updatedAt: new Date(),
                description: null,
                source: "uploaded",
                ...options.template
              }
            : null
      },
      claDocuments: {
        findFirst: async () => null
      }
    },
    insert: () => ({
      values: (values: Record<string, unknown>) => ({
        returning: async () => [
          {
            ...values,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ]
      })
    })
  } as any;
}

function fakeOctokitWithCla(body: string) {
  return {
    request: async () => ({
      data: {
        type: "file",
        content: Buffer.from(body, "utf8").toString("base64"),
        sha: "abc123"
      }
    })
  } as any;
}

function fakeOctokitThatShouldNotBeCalled() {
  return {
    request: async () => {
      throw new Error("Octokit should not be called for managed templates");
    }
  } as any;
}

function fakeOctokitMissingCla() {
  return {
    request: async () => {
      throw { status: 404 };
    }
  } as any;
}
