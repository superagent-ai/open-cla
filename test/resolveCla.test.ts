import { describe, expect, it } from "vitest";
import { resolveClaForRepository } from "../src/cla/resolveCla.js";

describe("resolveClaForRepository", () => {
  it("uses a repository CLA.md when present", async () => {
    const body = "# Custom CLA";
    const result = await resolveClaForRepository({
      db: fakeDb(),
      octokit: fakeOctokitWithCla(body),
      owner: "owner",
      repo: "repo",
      repositoryId: "100",
      defaultTemplateName: "individual-v1"
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
      defaultTemplateName: "individual-v1"
    });

    expect(result.source).toBe("default_template");
    expect(result.body).toContain("Contributor License Agreement");
    expect(result.versionHash).toHaveLength(64);
  });
});

function fakeDb() {
  return {
    query: {
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

function fakeOctokitMissingCla() {
  return {
    request: async () => {
      throw { status: 404 };
    }
  } as any;
}
