import type { App } from "@octokit/app";
import type { PullRequestEvent } from "@octokit/webhooks-types";
import type {
  RepositorySigningMode,
  SigningContext,
  SigningPageResponse,
  SigningSubmitResponse
} from "@superagent-cla/shared";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { and, eq } from "drizzle-orm";
import type { AppConfig } from "../config.js";
import { signClaPdfPath } from "../cla/pdfPaths.js";
import { resolveClaForRepository } from "../cla/resolveCla.js";
import { loadClaPdfBytes } from "../signing/loadClaPdf.js";
import type { DbClient } from "../db/client.js";
import {
  claDocuments,
  corporateAgreements,
  personalSignatures,
  repositorySigningSettings,
  signingProviderIntegrations,
  signatureRequests,
  repositories
} from "../db/schema.js";
import { getInstallationOctokit } from "../github/app.js";
import { assertActiveOrgOwner, githubUserFetch } from "../github/user.js";
import { handlePullRequestWebhook } from "../webhooks/pullRequest.js";
import { createId } from "../utils/ids.js";
import {
  createDropboxSigningRequest,
  getDropboxEventSignatureRequestId,
  verifyDropboxEventCallback
} from "../signing/dropboxSign.js";
import { decryptSigningCredential } from "../signing/credentials.js";
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

type SigningState = {
  context: SigningContext;
  repository: typeof repositories.$inferSelect;
  cla: Awaited<ReturnType<typeof resolveClaForRepository>>;
  signingMode: RepositorySigningMode;
  dropboxSignConfigured: boolean;
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

  app.get("/api/sign/cla/:documentId/pdf", async (request, reply) => {
    const session = await getCurrentSession(params.db, request);
    if (!session) {
      return reply.code(401).send({ error: "Authentication required" });
    }

    const { documentId } = request.params as { documentId: string };
    const signingState = await loadSigningState(params, request.query as SignQuery);
    if (!signingState.ok) {
      return reply.code(signingState.statusCode).send({ error: signingState.message });
    }

    if (signingState.cla.document.claDocumentId !== documentId) {
      return reply.code(403).send({ error: "CLA document is not available for this repository" });
    }

    try {
      const pdfBytes = await loadClaPdfBytes({
        pdfData: signingState.cla.document.pdfData ?? null,
        pdfUrl: signingState.cla.document.pdfUrl
      });
      return reply
        .header("content-type", "application/pdf")
        .header("cache-control", "private, max-age=3600")
        .send(Buffer.from(pdfBytes));
    } catch (error) {
      return reply.code(404).send({
        error: error instanceof Error ? error.message : "CLA PDF not found"
      });
    }
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

    const state = await loadRepositorySigningState(params.db, context);
    if (!state) {
      return reply.code(404).send({ error: "Repository not found" });
    }

    const claDocument = await getClaDocument(params.db, body.claDocumentId, body.claVersionHash);
    if (state.signingMode === "dropbox_sign") {
      const integration = await getRepositoryDropboxIntegration(params.db, state.repository.repositoryId);
      if (!integration) {
        return reply.code(400).send({ error: "Dropbox Sign credentials are not configured for this repository" });
      }
      if (!normalizeEmail(body.signerEmail)) {
        return reply.code(400).send({ error: "Dropbox Sign requires a valid signer email address" });
      }
      try {
        const response = await createDropboxSignatureRequestResponse({
          db: params.db,
          config: params.config,
          kind: "personal",
          session,
          context,
          repository: state.repository,
          integration,
          claDocument,
          claTitle: body.claTitle,
          signerEmail: body.signerEmail
        });
        return response;
      } catch (error) {
        return reply.code(502).send({ error: signingProviderErrorMessage(error) });
      }
    }

    await recordPersonalSignature(
      params.db,
      { githubUserId: session.user.githubUserId, login: session.user.login },
      { signerIp: getClientIp(request), userAgent: getUserAgent(request) },
      claDocument
    );
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

    const state = await loadRepositorySigningState(params.db, context);
    if (!state) {
      return reply.code(404).send({ error: "Repository not found" });
    }

    const claDocument = await getClaDocument(params.db, body.claDocumentId, body.claVersionHash);
    let org: GitHubOrg;
    try {
      await assertActiveOrgOwner(session.accessToken, orgLogin);
      org = await githubUserFetch<GitHubOrg>(session.accessToken, `/orgs/${encodeURIComponent(orgLogin)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "GitHub organization verification failed";
      return reply.code(403).send({ error: message });
    }

    if (state.signingMode === "dropbox_sign") {
      const integration = await getRepositoryDropboxIntegration(params.db, state.repository.repositoryId);
      if (!integration) {
        return reply.code(400).send({ error: "Dropbox Sign credentials are not configured for this repository" });
      }
      if (!normalizeEmail(body.signerEmail)) {
        return reply.code(400).send({ error: "Dropbox Sign requires a valid signer email address" });
      }
      try {
        const response = await createDropboxSignatureRequestResponse({
          db: params.db,
          config: params.config,
          kind: "corporate",
          session,
          context,
          repository: state.repository,
          integration,
          claDocument,
          claTitle: body.claTitle,
          signerEmail: body.signerEmail,
          org
        });
        return response;
      } catch (error) {
        return reply.code(502).send({ error: signingProviderErrorMessage(error) });
      }
    }

    await recordCorporateAgreement(
      params.db,
      { githubUserId: session.user.githubUserId, login: session.user.login },
      org,
      claDocument
    );
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

    await recordPersonalSignature(
      params.db,
      { githubUserId: session.user.githubUserId, login: session.user.login },
      { signerIp: getClientIp(request), userAgent: getUserAgent(request) },
      claDocument
    );

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
    await assertActiveOrgOwner(session.accessToken, orgLogin);
    const org = await githubUserFetch<GitHubOrg>(session.accessToken, `/orgs/${encodeURIComponent(orgLogin)}`);

    await recordCorporateAgreement(
      params.db,
      { githubUserId: session.user.githubUserId, login: session.user.login },
      org,
      claDocument
    );

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

  app.post("/api/sign/dropbox/webhook", async (request, reply) => {
    await handleDropboxSignEvent({
      db: params.db,
      githubApp: params.githubApp,
      config: params.config,
      body: request.body
    });

    return reply.type("text/plain").send("Hello API Event Received");
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
    cla,
    ...(await getRepositorySigningState(params.db, repository.repositoryId))
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
      contentFormat: state.cla.contentFormat,
      pdfUrl:
        state.cla.contentFormat === "pdf"
          ? signClaPdfPath(state.cla.document.claDocumentId, state.context)
          : state.cla.pdfUrl,
      versionHash: state.cla.versionHash,
      source: state.cla.source
    },
    signingMode: state.signingMode,
    dropboxSignConfigured: state.dropboxSignConfigured,
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

async function loadRepositorySigningState(
  db: DbClient,
  context: SigningContext
): Promise<{
  repository: typeof repositories.$inferSelect;
  signingMode: RepositorySigningMode;
  dropboxSignConfigured: boolean;
} | null> {
  const repository = await db.query.repositories.findFirst({
    where: (table) => and(eq(table.owner, context.owner), eq(table.name, context.repo))
  });
  if (!repository) {
    return null;
  }

  return {
    repository,
    ...(await getRepositorySigningState(db, repository.repositoryId))
  };
}

async function getRepositorySigningState(
  db: DbClient,
  repositoryId: string
): Promise<{ signingMode: RepositorySigningMode; dropboxSignConfigured: boolean }> {
  const [settings, integration] = await Promise.all([
    db.query.repositorySigningSettings.findFirst({
      where: (table) => eq(table.repositoryId, repositoryId)
    }),
    getRepositoryDropboxIntegration(db, repositoryId)
  ]);
  return {
    signingMode: settings?.signingMode ?? "simple",
    dropboxSignConfigured: Boolean(integration)
  };
}

async function getRepositoryDropboxIntegration(db: DbClient, repositoryId: string) {
  return db.query.signingProviderIntegrations.findFirst({
    where: (table) => and(eq(table.repositoryId, repositoryId), eq(table.provider, "dropbox_sign"))
  });
}

async function createDropboxSignatureRequestResponse(params: {
  db: DbClient;
  config: AppConfig;
  kind: "personal" | "corporate";
  session: CurrentSession;
  context: SigningContext;
  repository: typeof repositories.$inferSelect;
  integration: typeof signingProviderIntegrations.$inferSelect;
  claDocument: Awaited<ReturnType<typeof getClaDocument>>;
  claTitle?: string;
  signerEmail?: string;
  org?: GitHubOrg;
}): Promise<SigningSubmitResponse> {
  const signerEmail = normalizeEmail(params.signerEmail);
  if (!signerEmail) {
    throw new Error("Dropbox Sign requires a valid signer email address");
  }

  const result = await createDropboxSigningRequest({
    config: params.config,
    credentials: {
      apiKey: decryptSigningCredential(params.config, params.integration.encryptedApiKey)
    },
    title: params.claTitle?.trim() || "Contributor License Agreement",
    body: params.claDocument.body,
    contentFormat: params.claDocument.contentFormat,
    pdfData: params.claDocument.pdfData,
    pdfUrl: params.claDocument.pdfUrl,
    versionHash: params.claDocument.versionHash,
    signerName: params.session.user.login,
    signerEmail,
    repositoryFullName: params.repository.fullName,
    kind: params.kind,
    context: params.context,
    orgLogin: params.org?.login,
    signingRedirectUrl: buildDropboxSigningRedirectUrl(params.config, params.context, params.kind)
  });

  await params.db.insert(signatureRequests).values({
    signatureRequestId: createId("sigreq"),
    kind: params.kind,
    provider: "dropbox_sign",
    status: "pending",
    signingProviderIntegrationId: params.integration.signingProviderIntegrationId,
    repositoryId: params.repository.repositoryId,
    githubUserId: params.session.user.githubUserId,
    signerLogin: params.session.user.login,
    signerEmail,
    orgId: params.org ? String(params.org.id) : null,
    orgLogin: params.org?.login ?? null,
    claDocumentId: params.claDocument.claDocumentId,
    claVersionHash: params.claDocument.versionHash,
    owner: params.context.owner,
    repo: params.context.repo,
    pull: params.context.pull,
    sha: params.context.sha,
    providerRequestId: result.providerRequestId,
    providerSignatureId: result.providerSignatureId
  });

  return {
    ok: true,
    message: `Dropbox Sign emailed a signing link to ${signerEmail}.`,
    dropboxSignEmailSent: true,
    context: params.context
  };
}

function buildDropboxSigningRedirectUrl(
  config: AppConfig,
  context: SigningContext,
  kind: "personal" | "corporate"
): string {
  if (context.owner && context.repo && context.pull) {
    const owner = encodeURIComponent(context.owner);
    const repo = encodeURIComponent(context.repo);
    const pull = encodeURIComponent(context.pull);
    return `https://github.com/${owner}/${repo}/pull/${pull}`;
  }

  const params = new URLSearchParams();
  if (context.owner) params.set("owner", context.owner);
  if (context.repo) params.set("repo", context.repo);
  if (context.pull) params.set("pull", context.pull);
  if (context.sha) params.set("sha", context.sha);
  params.set("dropboxSigned", kind);
  return new URL(`/sign?${params.toString()}`, config.ADMIN_WEB_URL).toString();
}

async function recordPersonalSignature(
  db: DbClient,
  signer: { githubUserId: string; login: string },
  metadata: { signerIp?: string; userAgent?: string },
  claDocument: Awaited<ReturnType<typeof getClaDocument>>
): Promise<void> {
  await db
    .insert(personalSignatures)
    .values({
      signatureId: createId("sig"),
      githubUserId: signer.githubUserId,
      claDocumentId: claDocument.claDocumentId,
      claVersionHash: claDocument.versionHash,
      signerLogin: signer.login,
      signerIp: metadata.signerIp,
      userAgent: metadata.userAgent
    })
    .onConflictDoUpdate({
      target: [personalSignatures.githubUserId, personalSignatures.claVersionHash],
      set: {
        revokedAt: null,
        signedAt: new Date(),
        signerLogin: signer.login,
        signerIp: metadata.signerIp,
        userAgent: metadata.userAgent,
        updatedAt: new Date()
      }
    });
}

async function recordCorporateAgreement(
  db: DbClient,
  signer: { githubUserId: string; login: string },
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
      authorizedSignerUserId: signer.githubUserId,
      authorizedSignerLogin: signer.login
    })
    .onConflictDoUpdate({
      target: [corporateAgreements.orgId, corporateAgreements.claVersionHash],
      set: {
        authorizedSignerUserId: signer.githubUserId,
        authorizedSignerLogin: signer.login,
        effectiveUntil: null,
        updatedAt: new Date()
      }
    });
}

async function handleDropboxSignEvent(params: {
  db: DbClient;
  githubApp: App;
  config: AppConfig;
  body: unknown;
}): Promise<void> {
  const providerRequestId = getDropboxEventSignatureRequestId(params.body);
  if (!providerRequestId) {
    return;
  }

  const requestRow = await params.db.query.signatureRequests.findFirst({
    where: (table) =>
      and(
        eq(table.provider, "dropbox_sign"),
        eq(table.providerRequestId, providerRequestId)
      )
  });
  if (!requestRow) {
    return;
  }

  const integration = await params.db.query.signingProviderIntegrations.findFirst({
    where: (table) =>
      eq(table.signingProviderIntegrationId, requestRow.signingProviderIntegrationId)
  });
  if (!integration) {
    return;
  }

  const event = verifyDropboxEventCallback(
    decryptSigningCredential(params.config, integration.encryptedApiKey),
    params.body
  );
  if (!event || event.signatureRequestId !== providerRequestId) {
    return;
  }

  if (event.eventType === "signature_request_signed") {
    await params.db
      .update(signatureRequests)
      .set({
        status: requestRow.status === "completed" ? "completed" : "signed",
        providerPayload: event.payload,
        updatedAt: new Date()
      })
      .where(eq(signatureRequests.signatureRequestId, requestRow.signatureRequestId));
    return;
  }

  if (["signature_request_declined", "signature_request_canceled", "signature_request_expired"].includes(event.eventType)) {
    await params.db
      .update(signatureRequests)
      .set({
        status: event.eventType === "signature_request_expired" ? "expired" : "declined",
        providerPayload: event.payload,
        updatedAt: new Date()
      })
      .where(eq(signatureRequests.signatureRequestId, requestRow.signatureRequestId));
    return;
  }

  if (event.eventType !== "signature_request_all_signed") {
    return;
  }

  if (requestRow.status === "completed") {
    return;
  }

  const completedAt = eventTimeToDate(event.eventTime);
  const claDocument = await getClaDocument(
    params.db,
    requestRow.claDocumentId,
    requestRow.claVersionHash
  );
  const signer = {
    githubUserId: requestRow.githubUserId,
    login: requestRow.signerLogin
  };

  if (requestRow.kind === "personal") {
    await recordPersonalSignature(params.db, signer, {}, claDocument);
  } else if (requestRow.orgId && requestRow.orgLogin) {
    await recordCorporateAgreement(
      params.db,
      signer,
      { id: Number(requestRow.orgId), login: requestRow.orgLogin },
      claDocument
    );
  } else {
    await params.db
      .update(signatureRequests)
      .set({
        status: "failed",
        errorMessage: "Completed corporate Dropbox Sign request is missing organization information",
        providerPayload: event.payload,
        updatedAt: new Date()
      })
      .where(eq(signatureRequests.signatureRequestId, requestRow.signatureRequestId));
    return;
  }

  await params.db
    .update(signatureRequests)
    .set({
      status: "completed",
      completedAt,
      providerPayload: event.payload,
      updatedAt: new Date()
    })
    .where(eq(signatureRequests.signatureRequestId, requestRow.signatureRequestId));

  await triggerPullRequestRecheck({
    db: params.db,
    githubApp: params.githubApp,
    config: params.config,
    owner: requestRow.owner,
    repo: requestRow.repo,
    pull: requestRow.pull ?? undefined
  });
}

function optionalString(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeEmail(value: string | undefined): string | null {
  const trimmed = value?.trim().toLowerCase();
  if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

function signingProviderErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Signing provider request failed";
}

function eventTimeToDate(value: string): Date {
  const epochSeconds = Number(value);
  return Number.isFinite(epochSeconds) ? new Date(epochSeconds * 1000) : new Date();
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
