import { eq } from "drizzle-orm";
import type { DbClient } from "../db/client.js";
import { claDocuments, type ClaDocument } from "../db/schema.js";
import type { InstallationOctokit } from "../github/app.js";
import { createId } from "../utils/ids.js";
import { sha256 } from "../utils/sha.js";
import { getDefaultTemplate } from "./templates.js";

export type ResolvedCla = {
  document: ClaDocument;
  title: string;
  body: string;
  versionHash: string;
  source: "repository" | "default_template";
};

export async function resolveClaForRepository(params: {
  db: DbClient;
  octokit: InstallationOctokit;
  owner: string;
  repo: string;
  repositoryId: string;
  ref?: string;
  defaultTemplateName: string;
}): Promise<ResolvedCla> {
  const repoCla = await loadRepoCla({
    octokit: params.octokit,
    owner: params.owner,
    repo: params.repo,
    ref: params.ref
  });

  if (repoCla) {
    return persistResolvedCla({
      db: params.db,
      repositoryId: params.repositoryId,
      title: "Repository CLA",
      body: repoCla.body,
      source: "repository",
      path: "CLA.md",
      gitSha: repoCla.gitSha
    });
  }

  const template = getDefaultTemplate(params.defaultTemplateName);
  return persistResolvedCla({
    db: params.db,
    repositoryId: params.repositoryId,
    title: template.title,
    body: template.body,
    source: "default_template",
    templateName: template.name
  });
}

async function loadRepoCla(params: {
  octokit: InstallationOctokit;
  owner: string;
  repo: string;
  ref?: string;
}): Promise<{ body: string; gitSha: string | null } | null> {
  try {
    const response = await params.octokit.request<
      | { type: "file"; content: string; sha?: string }
      | Array<unknown>
      | { type?: string; content?: string; sha?: string }
    >("GET /repos/{owner}/{repo}/contents/{path}", {
      owner: params.owner,
      repo: params.repo,
      path: "CLA.md",
      ref: params.ref
    });

    if (
      Array.isArray(response.data) ||
      response.data.type !== "file" ||
      !("content" in response.data) ||
      !response.data.content
    ) {
      return null;
    }

    return {
      body: Buffer.from(response.data.content, "base64").toString("utf8"),
      gitSha: response.data.sha ?? null
    };
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }

    throw error;
  }
}

async function persistResolvedCla(params: {
  db: DbClient;
  repositoryId: string;
  title: string;
  body: string;
  source: "repository" | "default_template";
  templateName?: string;
  path?: string;
  gitSha?: string | null;
}): Promise<ResolvedCla> {
  const versionHash = sha256(params.body);
  const existing = await params.db.query.claDocuments.findFirst({
    where: (table, { and, eq }) =>
      and(eq(table.repositoryId, params.repositoryId), eq(table.versionHash, versionHash))
  });

  if (existing) {
    return {
      document: existing,
      title: params.title,
      body: existing.body,
      versionHash,
      source: existing.source
    };
  }

  const claDocumentId = createId("cla");
  const [document] = await params.db
    .insert(claDocuments)
    .values({
      claDocumentId,
      repositoryId: params.repositoryId,
      source: params.source,
      templateName: params.templateName,
      path: params.path,
      gitSha: params.gitSha,
      versionHash,
      body: params.body
    })
    .returning();

  if (!document) {
    throw new Error("Failed to persist CLA document");
  }

  return {
    document,
    title: params.title,
    body: document.body,
    versionHash,
    source: document.source
  };
}

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    Number((error as { status?: unknown }).status) === 404
  );
}
