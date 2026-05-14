import type { App } from "@octokit/app";
import type { PullRequestEvent } from "@octokit/webhooks-types";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { and, eq } from "drizzle-orm";
import type { AppConfig } from "../config.js";
import { resolveClaForRepository } from "../cla/resolveCla.js";
import type { DbClient } from "../db/client.js";
import {
  claDocuments,
  corporateAgreements,
  personalSignatures,
  repositories
} from "../db/schema.js";
import { getInstallationOctokit } from "../github/app.js";
import { handlePullRequestWebhook } from "../webhooks/pullRequest.js";
import { createId } from "../utils/ids.js";
import { getCurrentSession } from "./session.js";

type SignQuery = {
  owner?: string;
  repo?: string;
  pull?: string;
  sha?: string;
};

type FormBody = Record<string, string | undefined>;

type GitHubOrg = {
  id: number;
  login: string;
};

type GitHubOrgMembership = {
  role?: string;
  state?: string;
};

export async function registerSignRoutes(
  app: FastifyInstance,
  params: {
    db: DbClient;
    githubApp: App;
    config: AppConfig;
  }
): Promise<void> {
  app.get("/", async (_request, reply) => {
    return reply.type("text/html").send(
      page("Superagent CLA", [
        "<h1>Superagent CLA</h1>",
        "<p>This GitHub App verifies Contributor License Agreement coverage on pull requests.</p>"
      ].join("\n"))
    );
  });

  app.get("/sign", async (request, reply) => {
    const session = await getCurrentSession(params.db, request);
    if (!session) {
      return reply.redirect(
        `/auth/github/start?returnTo=${encodeURIComponent(request.url)}`
      );
    }

    const query = request.query as SignQuery;
    if (!query.owner || !query.repo) {
      return reply.code(400).type("text/html").send(
        page("Missing repository", "<p>Missing owner or repository in signing URL.</p>")
      );
    }

    const repository = await params.db.query.repositories.findFirst({
      where: (table) => and(eq(table.owner, query.owner!), eq(table.name, query.repo!))
    });

    if (!repository) {
      return reply.code(404).type("text/html").send(
        page(
          "Repository not found",
          "<p>This repository has not been seen by the CLA app yet. Open or update a pull request first.</p>"
        )
      );
    }

    const octokit = await getInstallationOctokit(params.githubApp, repository.installationId);
    const cla = await resolveClaForRepository({
      db: params.db,
      octokit,
      owner: query.owner,
      repo: query.repo,
      repositoryId: repository.repositoryId,
      ref: repository.defaultBranch,
      defaultTemplateName: params.config.DEFAULT_CLA_TEMPLATE_NAME
    });

    const hiddenFields = [
      hidden("claDocumentId", cla.document.claDocumentId),
      hidden("claVersionHash", cla.versionHash),
      hidden("owner", query.owner),
      hidden("repo", query.repo),
      hidden("pull", query.pull ?? ""),
      hidden("sha", query.sha ?? "")
    ].join("\n");

    return reply.type("text/html").send(
      page(
        "Sign CLA",
        [
          `<p>Signed in as <strong>@${escapeHtml(session.user.login)}</strong>.</p>`,
          `<h1>${escapeHtml(cla.title)}</h1>`,
          `<p><small>Source: ${escapeHtml(cla.source)}. Version: ${escapeHtml(cla.versionHash)}</small></p>`,
          `<pre>${escapeHtml(cla.body)}</pre>`,
          "<h2>Personal CLA</h2>",
          '<form method="post" action="/sign/personal">',
          hiddenFields,
          '<button type="submit">I agree and sign personally</button>',
          "</form>",
          "<h2>Corporate CLA</h2>",
          "<p>Corporate signing is limited to GitHub organization owners for the selected organization.</p>",
          '<form method="post" action="/sign/corporate">',
          hiddenFields,
          '<label>Organization login <input name="orgLogin" required /></label>',
          '<button type="submit">I agree on behalf of this organization</button>',
          "</form>"
        ].join("\n")
      )
    );
  });

  app.post("/sign/personal", async (request, reply) => {
    const session = await requireSession(params.db, request);
    const body = request.body as FormBody;
    const claDocument = await getClaDocument(params.db, body.claDocumentId, body.claVersionHash);

    await params.db
      .insert(personalSignatures)
      .values({
        signatureId: createId("sig"),
        githubUserId: session.user.githubUserId,
        claDocumentId: claDocument.claDocumentId,
        claVersionHash: claDocument.versionHash,
        signerLogin: session.user.login,
        signerIp: getClientIp(request),
        userAgent: request.headers["user-agent"]
      })
      .onConflictDoUpdate({
        target: [personalSignatures.githubUserId, personalSignatures.claVersionHash],
        set: {
          revokedAt: null,
          signedAt: new Date(),
          signerLogin: session.user.login,
          signerIp: getClientIp(request),
          userAgent: request.headers["user-agent"],
          updatedAt: new Date()
        }
      });

    await triggerPullRequestRecheck({
      db: params.db,
      githubApp: params.githubApp,
      config: params.config,
      owner: body.owner,
      repo: body.repo,
      pull: body.pull
    });

    return reply.type("text/html").send(
      page("CLA signed", '<p>Your personal CLA signature has been recorded.</p><p><a href="/">Done</a></p>')
    );
  });

  app.post("/sign/corporate", async (request, reply) => {
    const session = await requireSession(params.db, request);
    const body = request.body as FormBody;
    const orgLogin = body.orgLogin?.trim();
    if (!orgLogin) {
      return reply.code(400).send("Missing organization login");
    }

    const claDocument = await getClaDocument(params.db, body.claDocumentId, body.claVersionHash);
    await assertCanSignForOrg(session.accessToken, orgLogin);
    const org = await githubFetch<GitHubOrg>(session.accessToken, `/orgs/${encodeURIComponent(orgLogin)}`);

    await params.db
      .insert(corporateAgreements)
      .values({
        corporateAgreementId: createId("corp"),
        orgId: String(org.id),
        orgLogin: org.login,
        claDocumentId: claDocument.claDocumentId,
        claVersionHash: claDocument.versionHash,
        authorizedSignerUserId: session.user.githubUserId,
        authorizedSignerLogin: session.user.login
      })
      .onConflictDoUpdate({
        target: [corporateAgreements.orgId, corporateAgreements.claVersionHash],
        set: {
          authorizedSignerUserId: session.user.githubUserId,
          authorizedSignerLogin: session.user.login,
          effectiveUntil: null,
          updatedAt: new Date()
        }
      });

    await triggerPullRequestRecheck({
      db: params.db,
      githubApp: params.githubApp,
      config: params.config,
      owner: body.owner,
      repo: body.repo,
      pull: body.pull
    });

    return reply.type("text/html").send(
      page(
        "Corporate CLA signed",
        `<p>The corporate CLA for <strong>${escapeHtml(org.login)}</strong> has been recorded.</p><p><a href="/">Done</a></p>`
      )
    );
  });
}

async function requireSession(db: DbClient, request: FastifyRequest) {
  const session = await getCurrentSession(db, request);
  if (!session) {
    throw new Error("Authentication required");
  }

  return session;
}

async function getClaDocument(
  db: DbClient,
  claDocumentId: string | undefined,
  claVersionHash: string | undefined
) {
  if (!claDocumentId || !claVersionHash) {
    throw new Error("Missing CLA document information");
  }

  const claDocument = await db.query.claDocuments.findFirst({
    where: (table) =>
      and(eq(table.claDocumentId, claDocumentId), eq(table.versionHash, claVersionHash))
  });

  if (!claDocument) {
    throw new Error("CLA document not found");
  }

  return claDocument;
}

async function assertCanSignForOrg(token: string, orgLogin: string): Promise<void> {
  const membership = await githubFetch<GitHubOrgMembership>(
    token,
    `/user/memberships/orgs/${encodeURIComponent(orgLogin)}`
  );

  if (membership.state !== "active" || membership.role !== "admin") {
    throw new Error("Corporate CLA signing requires active GitHub organization owner access");
  }
}

async function githubFetch<T>(token: string, path: string): Promise<T> {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "user-agent": "superagent-cla"
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub API request failed for ${path} with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function triggerPullRequestRecheck(params: {
  db: DbClient;
  githubApp: App;
  config: AppConfig;
  owner?: string;
  repo?: string;
  pull?: string;
}): Promise<void> {
  if (!params.owner || !params.repo || !params.pull) {
    return;
  }

  const repository = await params.db.query.repositories.findFirst({
    where: (table) => and(eq(table.owner, params.owner!), eq(table.name, params.repo!))
  });

  if (!repository) {
    return;
  }

  const octokit = await getInstallationOctokit(params.githubApp, repository.installationId);
  const [pullRequestResponse, repositoryResponse] = await Promise.all([
    octokit.request<{
      draft: boolean;
      number: number;
      user: PullRequestEvent["pull_request"]["user"];
      head: { sha: string };
      base: { ref: string };
    }>("GET /repos/{owner}/{repo}/pulls/{pull_number}", {
      owner: params.owner,
      repo: params.repo,
      pull_number: Number(params.pull)
    }),
    octokit.request<{
      id: number;
      name: string;
      full_name: string;
      default_branch: string;
      private: boolean;
      owner: PullRequestEvent["repository"]["owner"];
    }>("GET /repos/{owner}/{repo}", {
      owner: params.owner,
      repo: params.repo
    })
  ]);

  const payload = {
    action: "synchronize",
    installation: { id: Number(repository.installationId) },
    pull_request: {
      draft: pullRequestResponse.data.draft,
      number: pullRequestResponse.data.number,
      user: pullRequestResponse.data.user,
      head: { sha: pullRequestResponse.data.head.sha },
      base: { ref: pullRequestResponse.data.base.ref }
    },
    repository: {
      id: repositoryResponse.data.id,
      name: repositoryResponse.data.name,
      full_name: repositoryResponse.data.full_name,
      default_branch: repositoryResponse.data.default_branch,
      private: repositoryResponse.data.private,
      owner: repositoryResponse.data.owner
    }
  } as PullRequestEvent;

  await handlePullRequestWebhook({
    db: params.db,
    octokit,
    config: params.config,
    payload
  });
}

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; line-height: 1.5; margin: 2rem auto; max-width: 800px; padding: 0 1rem; }
    pre { background: #f6f8fa; border: 1px solid #d0d7de; border-radius: 6px; padding: 1rem; white-space: pre-wrap; }
    form { border-top: 1px solid #d0d7de; margin-top: 1.5rem; padding-top: 1.5rem; }
    input { margin: 0 0.5rem; }
    button { cursor: pointer; }
  </style>
</head>
<body>
${body}
</body>
</html>`;
}

function hidden(name: string, value: string): string {
  return `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}" />`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getClientIp(request: FastifyRequest): string | undefined {
  const forwardedFor = request.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string") {
    return forwardedFor.split(",")[0]?.trim();
  }

  return request.ip;
}
