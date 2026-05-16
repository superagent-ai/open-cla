import type { App } from "@octokit/app";
import type { PullRequestEvent } from "@octokit/webhooks-types";
import type {
  SigningContext,
  SigningPageResponse,
  SigningSubmitResponse
} from "@superagent-cla/shared";
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
import { getCurrentSession, type CurrentSession } from "./session.js";

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

type SigningState = {
  context: SigningContext;
  repository: typeof repositories.$inferSelect;
  cla: Awaited<ReturnType<typeof resolveClaForRepository>>;
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
    return reply.redirect(webSignUrl(params.config, request.url));
  });

  app.get("/api/sign", async (request, reply) => {
    const session = await getCurrentSession(params.db, request);
    if (!session) {
      return reply.code(401).send({ error: "Authentication required" });
    }

    const state = await loadSigningState(params, request.query as SignQuery);
    if (!state.ok) {
      return reply.code(state.statusCode).send({ error: state.message });
    }

    return toSigningPageResponse(session, state);
  });

  app.post("/api/sign/personal", async (request, reply) => {
    const session = await getCurrentSession(params.db, request);
    if (!session) {
      return reply.code(401).send({ error: "Authentication required" });
    }

    const body = request.body as FormBody;
    const context = parseSigningContext(body);
    if (!context) {
      return reply.code(400).send({ error: "Missing owner or repository in signing request." });
    }

    const claDocument = await getClaDocument(params.db, body.claDocumentId, body.claVersionHash);
    await recordPersonalSignature(params.db, session, request, claDocument);
    await triggerPullRequestRecheck({
      db: params.db,
      githubApp: params.githubApp,
      config: params.config,
      owner: context.owner,
      repo: context.repo,
      pull: context.pull ?? undefined
    });

    const response: SigningSubmitResponse = {
      ok: true,
      message: "Your personal CLA signature has been recorded.",
      context
    };
    return response;
  });

  app.post("/api/sign/corporate", async (request, reply) => {
    const session = await getCurrentSession(params.db, request);
    if (!session) {
      return reply.code(401).send({ error: "Authentication required" });
    }

    const body = request.body as FormBody;
    const context = parseSigningContext(body);
    if (!context) {
      return reply.code(400).send({ error: "Missing owner or repository in signing request." });
    }

    const orgLogin = body.orgLogin?.trim();
    if (!orgLogin) {
      return reply.code(400).send({ error: "Missing organization login" });
    }

    const claDocument = await getClaDocument(params.db, body.claDocumentId, body.claVersionHash);
    let org: GitHubOrg;
    try {
      await assertCanSignForOrg(session.accessToken, orgLogin);
      org = await githubFetch<GitHubOrg>(session.accessToken, `/orgs/${encodeURIComponent(orgLogin)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "GitHub organization verification failed";
      return reply.code(403).send({ error: message });
    }

    await recordCorporateAgreement(params.db, session, org, claDocument);
    await triggerPullRequestRecheck({
      db: params.db,
      githubApp: params.githubApp,
      config: params.config,
      owner: context.owner,
      repo: context.repo,
      pull: context.pull ?? undefined
    });

    const response: SigningSubmitResponse = {
      ok: true,
      message: `The corporate CLA for ${org.login} has been recorded.`,
      context
    };
    return response;
  });

  app.post("/sign/personal", async (request, reply) => {
    const session = await requireSession(params.db, request);
    const body = request.body as FormBody;
    const claDocument = await getClaDocument(params.db, body.claDocumentId, body.claVersionHash);

    await recordPersonalSignature(params.db, session, request, claDocument);

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

    await recordCorporateAgreement(params.db, session, org, claDocument);

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

async function loadSigningState(
  params: {
    db: DbClient;
    githubApp: App;
    config: AppConfig;
  },
  query: SignQuery
): Promise<
  | ({ ok: true } & SigningState)
  | { ok: false; statusCode: 400 | 404; message: string }
> {
  const context = parseSigningContext(query);
  if (!context) {
    return {
      ok: false,
      statusCode: 400,
      message: "Missing owner or repository in signing URL."
    };
  }

  const repository = await params.db.query.repositories.findFirst({
    where: (table) => and(eq(table.owner, context.owner), eq(table.name, context.repo))
  });

  if (!repository) {
    return {
      ok: false,
      statusCode: 404,
      message: "This repository has not been seen by the CLA app yet. Open or update a pull request first."
    };
  }

  const octokit = await getInstallationOctokit(params.githubApp, repository.installationId);
  const cla = await resolveClaForRepository({
    db: params.db,
    octokit,
    owner: context.owner,
    repo: context.repo,
    repositoryId: repository.repositoryId,
    ref: repository.defaultBranch,
    defaultTemplateName: params.config.DEFAULT_CLA_TEMPLATE_NAME
  });

  return {
    ok: true,
    context,
    repository,
    cla
  };
}

function toSigningPageResponse(
  session: CurrentSession,
  state: SigningState
): SigningPageResponse {
  return {
    user: {
      githubUserId: session.user.githubUserId,
      login: session.user.login,
      avatarUrl: session.user.avatarUrl
    },
    repository: {
      owner: state.repository.owner,
      name: state.repository.name,
      fullName: state.repository.fullName
    },
    cla: {
      documentId: state.cla.document.claDocumentId,
      title: state.cla.title,
      body: state.cla.body,
      versionHash: state.cla.versionHash,
      source: state.cla.source
    },
    context: state.context
  };
}

function parseSigningContext(input: {
  owner?: string;
  repo?: string;
  pull?: string;
  sha?: string;
}): SigningContext | null {
  const owner = input.owner?.trim();
  const repo = input.repo?.trim();
  if (!owner || !repo) {
    return null;
  }

  return {
    owner,
    repo,
    pull: optionalString(input.pull),
    sha: optionalString(input.sha)
  };
}

async function recordPersonalSignature(
  db: DbClient,
  session: CurrentSession,
  request: FastifyRequest,
  claDocument: Awaited<ReturnType<typeof getClaDocument>>
): Promise<void> {
  await db
    .insert(personalSignatures)
    .values({
      signatureId: createId("sig"),
      githubUserId: session.user.githubUserId,
      claDocumentId: claDocument.claDocumentId,
      claVersionHash: claDocument.versionHash,
      signerLogin: session.user.login,
      signerIp: getClientIp(request),
      userAgent: getUserAgent(request)
    })
    .onConflictDoUpdate({
      target: [personalSignatures.githubUserId, personalSignatures.claVersionHash],
      set: {
        revokedAt: null,
        signedAt: new Date(),
        signerLogin: session.user.login,
        signerIp: getClientIp(request),
        userAgent: getUserAgent(request),
        updatedAt: new Date()
      }
    });
}

async function recordCorporateAgreement(
  db: DbClient,
  session: CurrentSession,
  org: GitHubOrg,
  claDocument: Awaited<ReturnType<typeof getClaDocument>>
): Promise<void> {
  await db
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
}

function optionalString(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function webSignUrl(config: AppConfig, requestUrl: string): string {
  const source = new URL(requestUrl, config.PUBLIC_APP_URL);
  const destination = new URL("/sign", config.ADMIN_WEB_URL);
  destination.search = source.search;
  return destination.toString();
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

function getUserAgent(request: FastifyRequest): string | undefined {
  const userAgent = request.headers["user-agent"];
  return Array.isArray(userAgent) ? userAgent[0] : userAgent;
}
