import {
  CreateGlobalTemplateRequestSchema,
  CreateTemplateRequestSchema,
  ImportDropboxTemplateRequestSchema,
  SaveDropboxSignIntegrationRequestSchema,
  SelectSigningModeRequestSchema,
  SelectTemplateRequestSchema,
  type AdminInstallation,
  type AdminRepository,
  type GlobalTemplateSummary,
  type PullRequestCoverage,
  type RepositorySigningSettings,
  type RepositoryTemplateSettings,
  type SignatureRecord,
  type TemplateSummary,
  type TemplateVersion
} from "@superagent-cla/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { DbClient } from "../db/client.js";
import {
  claDocuments,
  claTemplates,
  claTemplateVersions,
  corporateAgreements,
  personalSignatures,
  pullRequestChecks,
  repositories,
  repositorySigningSettings,
  repositoryTemplateSettings,
  signingProviderIntegrations,
  type ClaDocument,
  type ClaTemplate,
  type ClaTemplateVersion
} from "../db/schema.js";
import type { AppConfig } from "../config.js";
import { listDefaultTemplates, type DefaultClaTemplate } from "../cla/templates.js";
import { adminTemplatePdfPath } from "../cla/pdfPaths.js";
import { decodePdfBase64 } from "../signing/validatePdf.js";
import { createId } from "../utils/ids.js";
import { sha256, sha256Bytes } from "../utils/sha.js";
import {
  decryptSigningCredential,
  encryptSigningCredential
} from "../signing/credentials.js";
import { getDropboxTemplate } from "../signing/dropboxSign.js";
import {
  getUserDropboxSignCredentialLast4,
  resolveDropboxApiKey,
  saveUserDropboxSignCredential
} from "../signing/userCredentials.js";
import { getCurrentSession, type CurrentSession } from "./session.js";
import {
  createRepositoryAdminPermissionCache,
  hasRepositoryAdminPermission,
  type GitHubInstallationAccount,
  type RepositoryAdminPermissionCache
} from "../github/user.js";

type AdminRepositoryContext = {
  session: CurrentSession;
  repository: typeof repositories.$inferSelect;
};

export async function registerAdminRoutes(
  app: FastifyInstance,
  params: {
    db: DbClient;
    config: AppConfig;
  }
): Promise<void> {
  app.get("/api/admin/me", async (request, reply) => {
    const session = await getCurrentSession(params.db, request);
    if (!session) {
      return reply.code(401).send({ error: "Authentication required" });
    }

    return {
      githubUserId: session.user.githubUserId,
      login: session.user.login,
      avatarUrl: session.user.avatarUrl
    };
  });

  app.get("/api/admin/installations", async (request, reply) => {
    const session = await requireSession(params.db, request, reply);
    if (!session) {
      return;
    }

    const [allInstallations, allRepositories] = await Promise.all([
      params.db.query.installations.findMany(),
      params.db.query.repositories.findMany()
    ]);

    const installationsById = new Map(
      allInstallations.map((installation) => [installation.installationId, installation])
    );

    const accessibleRepositories = await filterAccessibleRepositories(
      session,
      allRepositories,
      installationsById
    );

    const installableRepositories = (
      await Promise.all(
        accessibleRepositories.map(async (repository) => {
          const stats = await getRepositoryStats(params.db, repository.repositoryId);
          return toAdminRepository(repository, true, stats);
        })
      )
    );

    const repositoriesByInstallation = new Map<string, AdminRepository[]>();
    for (const repository of installableRepositories) {
      const list = repositoriesByInstallation.get(repository.installationId) ?? [];
      list.push(repository);
      repositoriesByInstallation.set(repository.installationId, list);
    }

    const installations: AdminInstallation[] = allInstallations
      .map((installation) => ({
        installationId: installation.installationId,
        accountId: installation.accountId,
        accountLogin: installation.accountLogin,
        accountType: normalizeAccountType(installation.accountType),
        repositories: repositoriesByInstallation.get(installation.installationId) ?? []
      }))
      .filter((installation) => installation.repositories.length > 0);

    return { installations };
  });

  app.get("/api/admin/repositories/:repositoryId/templates", async (request, reply) => {
    const { repositoryId } = request.params as { repositoryId: string };
    const context = await requireAdminRepository(params, request, reply, repositoryId);
    if (!context) {
      return;
    }

    const templates = await listTemplatesForRepository(params.db, {
      repositoryId,
      githubUserId: context.session.user.githubUserId
    });
    const settings = await getRepositoryTemplateSettings(params.db, repositoryId);
    const signingSettings = await getRepositorySigningSettings(
      params.db,
      repositoryId,
      params.config,
      context.session.user.githubUserId
    );

    return {
      repository: toAdminRepository(context.repository, true),
      settings,
      signingSettings,
      templates
    };
  });

  app.post("/api/admin/templates", async (request, reply) => {
    const body = CreateTemplateRequestSchema.parse(request.body);
    const context = await requireAdminRepository(params, request, reply, body.repositoryId);
    if (!context) {
      return;
    }

    const templateId = createId("tmpl");
    const templateVersionId = createId("tmplver");
    const pdfData = decodePdfBase64(body.pdfBase64);
    const versionHash = sha256Bytes(pdfData);

    await params.db.insert(claTemplates).values({
      claTemplateId: templateId,
      repositoryId: context.repository.repositoryId,
      source: "uploaded",
      name: body.name,
      description: body.description ?? null,
      createdByGithubUserId: context.session.user.githubUserId,
      createdByLogin: context.session.user.login
    });

    const [version] = await params.db
      .insert(claTemplateVersions)
      .values({
        claTemplateVersionId: templateVersionId,
        claTemplateId: templateId,
        title: body.title,
        body: "",
        contentFormat: "pdf",
        pdfUrl: adminTemplatePdfPath(templateId),
        pdfFileName: body.pdfFileName,
        pdfData,
        versionHash,
        createdByGithubUserId: context.session.user.githubUserId,
        createdByLogin: context.session.user.login
      })
      .returning();

    if (!version) {
      throw new Error("Failed to create template version");
    }

    await selectTemplateVersion({
      db: params.db,
      repositoryId: context.repository.repositoryId,
      templateVersionId,
      session: context.session
    });

    return reply.code(201).send({
      template: await toTemplateSummaryForDb(params.db, {
        claTemplateId: templateId,
        repositoryId: context.repository.repositoryId,
        source: "uploaded",
        name: body.name,
        description: body.description ?? null,
        createdByGithubUserId: context.session.user.githubUserId,
        createdByLogin: context.session.user.login,
        createdAt: new Date(),
        updatedAt: new Date()
      }),
      selectedTemplateVersionId: version.claTemplateVersionId
    });
  });

  app.get("/api/admin/templates", async (request, reply) => {
    const session = await requireSession(params.db, request, reply);
    if (!session) {
      return;
    }

    await ensureDefaultTemplates(params.db);

    const allTemplates = await params.db.query.claTemplates.findMany({
      where: (table, { and, eq, isNull, or }) =>
        and(
          isNull(table.repositoryId),
          or(
            eq(table.source, "default"),
            and(
              or(eq(table.source, "uploaded"), eq(table.source, "dropbox_sign")),
              eq(table.createdByGithubUserId, session.user.githubUserId)
            )
          )
        )
    });

    const latestVersions = await getLatestTemplateVersionsByTemplateIds(
      params.db,
      allTemplates.map((template) => template.claTemplateId)
    );
    const summaries: GlobalTemplateSummary[] = allTemplates.map((template) => {
      const summary = toTemplateSummary(
        template,
        latestVersions.get(template.claTemplateId) ?? null
      );
      return {
        ...summary,
        createdByLogin: template.createdByLogin,
        createdAt: template.createdAt.toISOString(),
        isMine: template.createdByGithubUserId === session.user.githubUserId
      };
    });

    summaries.sort((left, right) => {
      if (left.source !== right.source) {
        return left.source === "default" ? -1 : 1;
      }
      return left.name.localeCompare(right.name);
    });

    return { templates: summaries };
  });

  app.get("/api/admin/users", async (request, reply) => {
    const session = await requireSession(params.db, request, reply);
    if (!session) {
      return;
    }

    const accessibleRepositories = await listAccessibleRepositories(params.db, session);
    const repositoryIds = accessibleRepositories.map((repository) => repository.repositoryId);
    if (repositoryIds.length === 0) {
      return { users: [] };
    }

    const documents = await params.db.query.claDocuments.findMany({
      where: (table) => inArray(table.repositoryId, repositoryIds)
    });
    const documentIds = documents.map((document) => document.claDocumentId);
    if (documentIds.length === 0) {
      return { users: [] };
    }

    const personalSignatures = await params.db.query.personalSignatures.findMany({
      where: (table) => inArray(table.claDocumentId, documentIds)
    });

    const counts = new Map<string, number>();
    for (const row of personalSignatures) {
      counts.set(row.githubUserId, (counts.get(row.githubUserId) ?? 0) + 1);
    }

    const githubUserIds = [...counts.keys()];
    if (githubUserIds.length === 0) {
      return { users: [] };
    }

    const users = await params.db.query.githubUsers.findMany({
      where: (table) => inArray(table.githubUserId, githubUserIds)
    });

    const summarized = users
      .map((user) => ({
        githubUserId: user.githubUserId,
        login: user.login,
        avatarUrl: user.avatarUrl,
        signatureCount: counts.get(user.githubUserId) ?? 0
      }))
      .sort((left, right) => left.login.localeCompare(right.login));

    return { users: summarized };
  });

  app.get("/api/admin/templates/:templateId", async (request, reply) => {
    const session = await requireSession(params.db, request, reply);
    if (!session) {
      return;
    }

    const { templateId } = request.params as { templateId: string };
    const template = await params.db.query.claTemplates.findFirst({
      where: (table) => eq(table.claTemplateId, templateId)
    });
    if (!template || template.repositoryId !== null) {
      return reply.code(404).send({ error: "Template not found" });
    }

    const isVisibleDefault = template.source === "default";
    const isOwnedCustom =
      (template.source === "uploaded" || template.source === "dropbox_sign") &&
      template.createdByGithubUserId === session.user.githubUserId;
    if (!isVisibleDefault && !isOwnedCustom) {
      return reply.code(403).send({ error: "Template not accessible" });
    }

    const summary = await toTemplateSummaryForDb(params.db, template);
    const latestVersion = summary.latestVersion;
    return {
      template: {
        ...summary,
        createdByLogin: template.createdByLogin,
        createdAt: template.createdAt.toISOString(),
        isMine: isOwnedCustom
      },
      contentFormat: latestVersion?.contentFormat ?? "markdown",
      body: latestVersion?.body ?? "",
      pdfUrl:
        latestVersion?.contentFormat === "pdf"
          ? adminTemplatePdfPath(templateId)
          : (latestVersion?.pdfUrl ?? null),
      pdfFileName: latestVersion?.pdfFileName ?? null
    };
  });

  app.get("/api/admin/templates/:templateId/pdf", async (request, reply) => {
    const session = await requireSession(params.db, request, reply);
    if (!session) {
      return;
    }

    const { templateId } = request.params as { templateId: string };
    const template = await params.db.query.claTemplates.findFirst({
      where: (table) => eq(table.claTemplateId, templateId)
    });
    if (!template || template.repositoryId !== null) {
      return reply.code(404).send({ error: "Template not found" });
    }

    const isVisibleDefault = template.source === "default";
    const isOwnedCustom =
      (template.source === "uploaded" || template.source === "dropbox_sign") &&
      template.createdByGithubUserId === session.user.githubUserId;
    if (!isVisibleDefault && !isOwnedCustom) {
      return reply.code(403).send({ error: "Template not accessible" });
    }

    const version = await getLatestTemplateVersion(params.db, templateId);
    if (!version?.pdfData) {
      return reply.code(404).send({ error: "PDF not found" });
    }

    return reply
      .header("content-type", "application/pdf")
      .header("cache-control", "private, max-age=3600")
      .send(version.pdfData);
  });

  app.put("/api/admin/templates/:templateId", async (_request, reply) => {
    return reply.code(405).send({
      error: "Uploaded templates are PDF-only. Create a new template to replace the file."
    });
  });

  app.post("/api/admin/templates/:templateId/duplicate", async (_request, reply) => {
    return reply.code(405).send({ error: "Template duplication is not supported." });
  });

  app.delete("/api/admin/templates/:templateId", async (request, reply) => {
    const session = await requireSession(params.db, request, reply);
    if (!session) {
      return;
    }

    const { templateId } = request.params as { templateId: string };
    const template = await params.db.query.claTemplates.findFirst({
      where: (table) => eq(table.claTemplateId, templateId)
    });
    if (!template || template.repositoryId !== null) {
      return reply.code(404).send({ error: "Template not found" });
    }
    if (
      (template.source !== "uploaded" && template.source !== "dropbox_sign") ||
      template.createdByGithubUserId !== session.user.githubUserId
    ) {
      return reply.code(403).send({ error: "Template not deletable" });
    }

    await params.db.delete(claTemplates).where(eq(claTemplates.claTemplateId, template.claTemplateId));

    return reply.send({ ok: true });
  });

  app.post("/api/admin/templates/global", async (request, reply) => {
    const session = await requireSession(params.db, request, reply);
    if (!session) {
      return;
    }

    const body = CreateGlobalTemplateRequestSchema.parse(request.body);

    const templateId = createId("tmpl");
    const templateVersionId = createId("tmplver");
    const pdfData = decodePdfBase64(body.pdfBase64);
    const versionHash = sha256Bytes(pdfData);

    await params.db.insert(claTemplates).values({
      claTemplateId: templateId,
      repositoryId: null,
      source: "uploaded",
      name: body.name,
      description: body.description ?? null,
      createdByGithubUserId: session.user.githubUserId,
      createdByLogin: session.user.login
    });

    await params.db.insert(claTemplateVersions).values({
      claTemplateVersionId: templateVersionId,
      claTemplateId: templateId,
      title: body.title,
      body: "",
      contentFormat: "pdf",
      pdfUrl: adminTemplatePdfPath(templateId),
      pdfFileName: body.pdfFileName,
      pdfData,
      versionHash,
      createdByGithubUserId: session.user.githubUserId,
      createdByLogin: session.user.login
    });

    return reply.code(201).send({ ok: true, templateId });
  });

  app.post("/api/admin/templates/dropbox", async (request, reply) => {
    const session = await requireSession(params.db, request, reply);
    if (!session) {
      return;
    }

    const body = ImportDropboxTemplateRequestSchema.parse(request.body);
    const dropboxApiKey = await resolveDropboxApiKey(
      params.db,
      params.config,
      session.user.githubUserId,
      body.dropboxApiKey
    );
    if (!dropboxApiKey) {
      return reply.code(400).send({ error: "Dropbox Sign API key is required" });
    }

    if (body.dropboxApiKey) {
      await saveUserDropboxSignCredential(
        params.db,
        params.config,
        session.user.githubUserId,
        body.dropboxApiKey
      );
    }

    let templateMetadata: Awaited<ReturnType<typeof getDropboxTemplate>>;
    try {
      templateMetadata = await getDropboxTemplate(
        { apiKey: dropboxApiKey },
        body.dropboxTemplateId
      );
    } catch (error) {
      return reply.code(502).send({ error: signingProviderErrorMessage(error) });
    }

    const signerRole = resolveDropboxSignerRole(templateMetadata.signerRoles, body.signerRole);
    if (!signerRole) {
      return reply.code(400).send({
        error:
          templateMetadata.signerRoles.length > 1
            ? "Choose the Dropbox signer role contributors should use for this template"
            : "Dropbox template does not define a signer role"
      });
    }

    const templateId = createId("tmpl");
    const templateVersionId = createId("tmplver");
    const title = body.title || templateMetadata.title || body.name;
    const versionHash = sha256(`${templateMetadata.templateId}:${signerRole}`);

    await params.db.insert(claTemplates).values({
      claTemplateId: templateId,
      repositoryId: null,
      source: "dropbox_sign",
      name: body.name,
      description: body.description ?? null,
      createdByGithubUserId: session.user.githubUserId,
      createdByLogin: session.user.login
    });

    await params.db.insert(claTemplateVersions).values({
      claTemplateVersionId: templateVersionId,
      claTemplateId: templateId,
      title,
      body: "",
      contentFormat: "dropbox_template",
      dropboxTemplateId: templateMetadata.templateId,
      dropboxSignerRole: signerRole,
      dropboxTemplateSnapshot: {
        title: templateMetadata.title,
        signerRoles: templateMetadata.signerRoles
      },
      versionHash,
      createdByGithubUserId: session.user.githubUserId,
      createdByLogin: session.user.login
    });

    return reply.code(201).send({ ok: true, templateId });
  });

  app.put("/api/admin/repositories/:repositoryId/template-selection", async (request, reply) => {
    const { repositoryId } = request.params as { repositoryId: string };
    const body = SelectTemplateRequestSchema.parse({
      ...(request.body as Record<string, unknown>),
      repositoryId
    });
    const context = await requireAdminRepository(params, request, reply, repositoryId);
    if (!context) {
      return;
    }

    let selectedVersion: ClaTemplateVersion | null = null;
    if (body.templateVersionId) {
      selectedVersion = await assertTemplateVersionSelectable(
        params.db,
        repositoryId,
        body.templateVersionId,
        context.session.user.githubUserId
      );
      if (selectedVersion.contentFormat === "dropbox_template") {
        const integration = await ensureDropboxSignIntegration(params, repositoryId, context.session);
        if (!integration) {
          return reply.code(400).send({
            error: "Import a Dropbox Sign template with your API key before selecting this template"
          });
        }
      }
    }

    await selectTemplateVersion({
      db: params.db,
      repositoryId,
      templateVersionId: body.templateVersionId,
      session: context.session
    });

    if (selectedVersion?.contentFormat === "dropbox_template") {
      await selectSigningMode({
        db: params.db,
        repositoryId,
        signingMode: "dropbox_sign",
        session: context.session
      });
    }

    return {
      settings: await getRepositoryTemplateSettings(params.db, repositoryId),
      signingSettings: await getRepositorySigningSettings(
        params.db,
        repositoryId,
        params.config,
        context.session.user.githubUserId
      )
    };
  });

  app.put("/api/admin/repositories/:repositoryId/signing-settings", async (request, reply) => {
    const { repositoryId } = request.params as { repositoryId: string };
    const body = SelectSigningModeRequestSchema.parse({
      ...(request.body as Record<string, unknown>),
      repositoryId
    });
    const context = await requireAdminRepository(params, request, reply, repositoryId);
    if (!context) {
      return;
    }

    if (body.signingMode === "dropbox_sign") {
      const integration = await ensureDropboxSignIntegration(params, repositoryId, context.session);
      if (!integration) {
        return reply.code(400).send({
          error:
            "Import a Dropbox Sign template with your API key first, or save Dropbox Sign credentials for this repository"
        });
      }
    }

    await selectSigningMode({
      db: params.db,
      repositoryId,
      signingMode: body.signingMode,
      session: context.session
    });

    return {
      signingSettings: await getRepositorySigningSettings(
        params.db,
        repositoryId,
        params.config,
        context.session.user.githubUserId
      )
    };
  });

  app.put("/api/admin/repositories/:repositoryId/dropbox-sign-integration", async (request, reply) => {
    const { repositoryId } = request.params as { repositoryId: string };
    const body = SaveDropboxSignIntegrationRequestSchema.parse({
      ...(request.body as Record<string, unknown>),
      repositoryId
    });
    const context = await requireAdminRepository(params, request, reply, repositoryId);
    if (!context) {
      return;
    }

    try {
      await saveDropboxSignIntegration({
        db: params.db,
        config: params.config,
        repositoryId,
        apiKey: body.apiKey,
        session: context.session
      });
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Failed to save Dropbox Sign credentials"
      });
    }

    return {
      signingSettings: await getRepositorySigningSettings(
        params.db,
        repositoryId,
        params.config,
        context.session.user.githubUserId
      )
    };
  });

  app.get("/api/admin/repositories/:repositoryId/signatures", async (request, reply) => {
    const { repositoryId } = request.params as { repositoryId: string };
    const context = await requireAdminRepository(params, request, reply, repositoryId);
    if (!context) {
      return;
    }

    const { signatures, pullRequestChecks: checks } = await listSignatureRecords(
      params.db,
      repositoryId
    );

    return {
      repository: toAdminRepository(context.repository, true),
      signatures,
      pullRequestChecks: checks
    };
  });
}

async function requireSession(
  db: DbClient,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<CurrentSession | null> {
  const session = await getCurrentSession(db, request);
  if (!session) {
    reply.code(401).send({ error: "Authentication required" });
    return null;
  }

  return session;
}

async function requireAdminRepository(
  params: {
    db: DbClient;
  },
  request: FastifyRequest,
  reply: FastifyReply,
  repositoryId: string
): Promise<AdminRepositoryContext | null> {
  const session = await requireSession(params.db, request, reply);
  if (!session) {
    return null;
  }

  const repository = await params.db.query.repositories.findFirst({
    where: (table) => eq(table.repositoryId, repositoryId)
  });
  if (!repository) {
    reply.code(404).send({ error: "Repository not found" });
    return null;
  }

  const installation = await params.db.query.installations.findFirst({
    where: (table) => eq(table.installationId, repository.installationId)
  });

  const adminPermission = await resolveRepositoryAdminPermission(
    session,
    repository,
    installation
  );
  if (!adminPermission) {
    reply.code(403).send({ error: "Repository admin permission required" });
    return null;
  }

  return { session, repository };
}

async function resolveRepositoryAdminPermission(
  session: CurrentSession,
  repository: typeof repositories.$inferSelect,
  installation?: {
    accountId: string;
    accountLogin: string;
    accountType: string;
  } | null,
  cache?: RepositoryAdminPermissionCache
): Promise<boolean> {
  return hasRepositoryAdminPermission({
    accessToken: session.accessToken,
    githubUserId: session.user.githubUserId,
    owner: repository.owner,
    name: repository.name,
    installation: installation ? toInstallationAccount(installation) : null,
    cache
  });
}

function toInstallationAccount(installation: {
  accountId: string;
  accountLogin: string;
  accountType: string;
}): GitHubInstallationAccount {
  return {
    accountId: installation.accountId,
    accountLogin: installation.accountLogin,
    accountType: installation.accountType
  };
}

async function listAccessibleRepositories(
  db: DbClient,
  session: CurrentSession
): Promise<Array<typeof repositories.$inferSelect>> {
  const [allInstallations, allRepositories] = await Promise.all([
    db.query.installations.findMany(),
    db.query.repositories.findMany()
  ]);

  const installationsById = new Map(
    allInstallations.map((installation) => [installation.installationId, installation])
  );

  return filterAccessibleRepositories(session, allRepositories, installationsById);
}

async function filterAccessibleRepositories(
  session: CurrentSession,
  allRepositories: Array<typeof repositories.$inferSelect>,
  installationsById: Map<
    string,
    {
      accountId: string;
      accountLogin: string;
      accountType: string;
    }
  >
): Promise<Array<typeof repositories.$inferSelect>> {
  const permissionCache = createRepositoryAdminPermissionCache(session.accessToken);

  const accessibleRepositories = await Promise.all(
    allRepositories.map(async (repository) => {
      const installation = installationsById.get(repository.installationId);
      const adminPermission = await resolveRepositoryAdminPermission(
        session,
        repository,
        installation,
        permissionCache
      );
      return adminPermission ? repository : null;
    })
  );

  return accessibleRepositories.filter(
    (repository): repository is typeof repositories.$inferSelect => repository !== null
  );
}

async function listTemplatesForRepository(
  db: DbClient,
  params: {
    repositoryId: string;
    githubUserId: string;
  }
): Promise<TemplateSummary[]> {
  const defaultTemplates = await ensureDefaultTemplates(db);
  const [perRepoTemplates, globalCustomTemplates] = await Promise.all([
    db.query.claTemplates.findMany({
      where: (table) => eq(table.repositoryId, params.repositoryId)
    }),
    db.query.claTemplates.findMany({
      where: (table, { and, eq: equals, isNull, or }) =>
        and(
          isNull(table.repositoryId),
          or(equals(table.source, "uploaded"), equals(table.source, "dropbox_sign")),
          equals(table.createdByGithubUserId, params.githubUserId)
        )
    })
  ]);

  const templates = [...defaultTemplates, ...globalCustomTemplates, ...perRepoTemplates];
  const latestVersions = await getLatestTemplateVersionsByTemplateIds(
    db,
    templates.map((template) => template.claTemplateId)
  );

  return templates.map((template) =>
    toTemplateSummary(template, latestVersions.get(template.claTemplateId) ?? null)
  );
}

async function ensureDefaultTemplates(db: DbClient): Promise<ClaTemplate[]> {
  const templates: ClaTemplate[] = [];
  for (const defaultTemplate of listDefaultTemplates()) {
    templates.push(await ensureDefaultTemplate(db, defaultTemplate));
  }
  return templates;
}

async function ensureDefaultTemplate(db: DbClient, defaultTemplate: DefaultClaTemplate): Promise<ClaTemplate> {
  const existing = await db.query.claTemplates.findFirst({
    where: (table) =>
      and(eq(table.source, "default"), eq(table.name, defaultTemplate.name), isNull(table.repositoryId))
  });
  let template = existing ?? (await createDefaultTemplate(db, defaultTemplate));

  if (existing && existing.description !== defaultTemplate.description) {
    await db
      .update(claTemplates)
      .set({
        description: defaultTemplate.description,
        updatedAt: new Date()
      })
      .where(eq(claTemplates.claTemplateId, existing.claTemplateId));
    template = {
      ...existing,
      description: defaultTemplate.description,
      updatedAt: new Date()
    };
  }

  const versionHash = sha256(defaultTemplate.body);
  const existingVersion = await db.query.claTemplateVersions.findFirst({
    where: (table) =>
      and(eq(table.claTemplateId, template.claTemplateId), eq(table.versionHash, versionHash))
  });
  if (!existingVersion) {
    await db.insert(claTemplateVersions).values({
      claTemplateVersionId: createId("tmplver"),
      claTemplateId: template.claTemplateId,
      title: defaultTemplate.title,
      body: defaultTemplate.body,
      versionHash
    });
  }

  return template;
}

async function createDefaultTemplate(
  db: DbClient,
  template: DefaultClaTemplate
): Promise<ClaTemplate> {
  const [created] = await db
    .insert(claTemplates)
    .values({
      claTemplateId: createId("tmpl"),
      repositoryId: null,
      source: "default",
      name: template.name,
      description: template.description
    })
    .returning();

  if (!created) {
    throw new Error("Failed to create default template");
  }

  return created;
}

async function toTemplateSummaryForDb(
  db: DbClient,
  template: ClaTemplate
): Promise<TemplateSummary> {
  const latestVersion = await getLatestTemplateVersion(db, template.claTemplateId);
  return toTemplateSummary(template, latestVersion);
}

function toTemplateSummary(
  template: ClaTemplate,
  latestVersion: ClaTemplateVersion | null
): TemplateSummary {
  return {
    templateId: template.claTemplateId,
    name: template.name,
    description: template.description,
    source: template.source,
    repositoryId: template.repositoryId ?? null,
    latestVersion: latestVersion ? toTemplateVersion(latestVersion) : null
  };
}

async function getLatestTemplateVersionsByTemplateIds(
  db: DbClient,
  templateIds: string[]
): Promise<Map<string, ClaTemplateVersion>> {
  if (templateIds.length === 0) {
    return new Map();
  }

  const versions = await db.query.claTemplateVersions.findMany({
    where: (table) => inArray(table.claTemplateId, templateIds)
  });

  const latestByTemplateId = new Map<string, ClaTemplateVersion>();
  for (const version of versions) {
    const current = latestByTemplateId.get(version.claTemplateId);
    if (!current || compareByCreatedAtDesc(version, current) < 0) {
      latestByTemplateId.set(version.claTemplateId, version);
    }
  }

  return latestByTemplateId;
}

async function getLatestTemplateVersion(
  db: DbClient,
  templateId: string
): Promise<ClaTemplateVersion | null> {
  const latestVersions = await getLatestTemplateVersionsByTemplateIds(db, [templateId]);
  return latestVersions.get(templateId) ?? null;
}

function toTemplateVersion(version: ClaTemplateVersion): TemplateVersion {
  return {
    templateVersionId: version.claTemplateVersionId,
    templateId: version.claTemplateId,
    title: version.title,
    versionHash: version.versionHash,
    contentFormat: version.contentFormat,
    body: version.body,
    pdfUrl: version.pdfUrl,
    pdfFileName: version.pdfFileName,
    dropboxTemplateId: version.dropboxTemplateId,
    dropboxSignerRole: version.dropboxSignerRole,
    dropboxTemplateSnapshot: normalizeDropboxTemplateSnapshot(version.dropboxTemplateSnapshot),
    createdByLogin: version.createdByLogin,
    createdAt: version.createdAt.toISOString()
  };
}

function normalizeDropboxTemplateSnapshot(
  value: Record<string, unknown> | null | undefined
): TemplateVersion["dropboxTemplateSnapshot"] {
  if (!value) {
    return null;
  }
  const title = typeof value.title === "string" ? value.title : null;
  const signerRoles = Array.isArray(value.signerRoles)
    ? value.signerRoles.filter((role): role is string => typeof role === "string" && role.length > 0)
    : [];
  return { title, signerRoles };
}

async function getRepositoryTemplateSettings(
  db: DbClient,
  repositoryId: string
): Promise<RepositoryTemplateSettings> {
  const settings = await db.query.repositoryTemplateSettings.findFirst({
    where: (table) => eq(table.repositoryId, repositoryId)
  });
  if (!settings || settings.mode === "repository" || !settings.claTemplateVersionId) {
    return {
      repositoryId,
      mode: "repository",
      selectedTemplateVersionId: null,
      selectedTemplateName: null,
      selectedTemplateHash: null,
      updatedByLogin: settings?.updatedByLogin ?? null,
      updatedAt: settings?.updatedAt.toISOString() ?? null
    };
  }

  const version = await db.query.claTemplateVersions.findFirst({
    where: (table) => eq(table.claTemplateVersionId, settings.claTemplateVersionId!)
  });
  const template = version
    ? await db.query.claTemplates.findFirst({
        where: (table) => eq(table.claTemplateId, version.claTemplateId)
      })
    : null;

  return {
    repositoryId,
    mode: "managed",
    selectedTemplateVersionId: settings.claTemplateVersionId,
    selectedTemplateName: template?.name ?? null,
    selectedTemplateHash: version?.versionHash ?? null,
    updatedByLogin: settings.updatedByLogin,
    updatedAt: settings.updatedAt.toISOString()
  };
}

async function getRepositorySigningSettings(
  db: DbClient,
  repositoryId: string,
  config: AppConfig,
  githubUserId: string
): Promise<RepositorySigningSettings> {
  const [settings, integration, accountDropboxSignApiKeyLast4] = await Promise.all([
    db.query.repositorySigningSettings.findFirst({
      where: (table) => eq(table.repositoryId, repositoryId)
    }),
    getDropboxSignIntegration(db, repositoryId),
    getUserDropboxSignCredentialLast4(db, githubUserId)
  ]);

  return {
    repositoryId,
    signingMode: settings?.signingMode ?? "simple",
    dropboxSignConfigured: Boolean(integration),
    dropboxSignApiKeyLast4: integration?.apiKeyLast4 ?? null,
    accountDropboxSignApiKeyLast4,
    dropboxSignCallbackUrl: new URL("/api/sign/dropbox/webhook", config.PUBLIC_APP_URL).toString(),
    updatedByLogin: settings?.updatedByLogin ?? integration?.updatedByLogin ?? null,
    updatedAt: (settings?.updatedAt ?? integration?.updatedAt)?.toISOString() ?? null
  };
}

async function getDropboxSignIntegration(db: DbClient, repositoryId: string) {
  return db.query.signingProviderIntegrations.findFirst({
    where: (table) => eq(table.repositoryId, repositoryId)
  });
}

function resolveDropboxSignerRole(
  availableRoles: string[],
  requestedRole: string | undefined
): string | null {
  if (requestedRole) {
    return availableRoles.includes(requestedRole) ? requestedRole : null;
  }
  return availableRoles.length === 1 ? (availableRoles[0] ?? null) : null;
}

async function assertTemplateVersionSelectable(
  db: DbClient,
  repositoryId: string,
  templateVersionId: string,
  githubUserId: string
): Promise<ClaTemplateVersion> {
  const version = await db.query.claTemplateVersions.findFirst({
    where: (table) => eq(table.claTemplateVersionId, templateVersionId)
  });
  if (!version) {
    throw new Error("Template version not found");
  }

  const template = await db.query.claTemplates.findFirst({
    where: (table) => eq(table.claTemplateId, version.claTemplateId)
  });
  if (!template || (template.repositoryId && template.repositoryId !== repositoryId)) {
    throw new Error("Template version is not available for this repository");
  }

  if (
    (template.source === "uploaded" || template.source === "dropbox_sign") &&
    template.repositoryId === null &&
    template.createdByGithubUserId !== githubUserId
  ) {
    throw new Error("Template version is not available for this repository");
  }

  return version;
}

async function selectTemplateVersion(params: {
  db: DbClient;
  repositoryId: string;
  templateVersionId: string | null;
  session: CurrentSession;
}): Promise<void> {
  await params.db
    .insert(repositoryTemplateSettings)
    .values({
      repositoryId: params.repositoryId,
      mode: params.templateVersionId ? "managed" : "repository",
      claTemplateVersionId: params.templateVersionId,
      updatedByGithubUserId: params.session.user.githubUserId,
      updatedByLogin: params.session.user.login
    })
    .onConflictDoUpdate({
      target: repositoryTemplateSettings.repositoryId,
      set: {
        mode: params.templateVersionId ? "managed" : "repository",
        claTemplateVersionId: params.templateVersionId,
        updatedByGithubUserId: params.session.user.githubUserId,
        updatedByLogin: params.session.user.login,
        updatedAt: new Date()
      }
    });
}

async function selectSigningMode(params: {
  db: DbClient;
  repositoryId: string;
  signingMode: RepositorySigningSettings["signingMode"];
  session: CurrentSession;
}): Promise<void> {
  const integration = params.signingMode === "dropbox_sign"
    ? await getDropboxSignIntegration(params.db, params.repositoryId)
    : null;

  await params.db
    .insert(repositorySigningSettings)
    .values({
      repositoryId: params.repositoryId,
      signingMode: params.signingMode,
      signingProviderIntegrationId: integration?.signingProviderIntegrationId ?? null,
      updatedByGithubUserId: params.session.user.githubUserId,
      updatedByLogin: params.session.user.login
    })
    .onConflictDoUpdate({
      target: repositorySigningSettings.repositoryId,
      set: {
        signingMode: params.signingMode,
        signingProviderIntegrationId: integration?.signingProviderIntegrationId ?? null,
        updatedByGithubUserId: params.session.user.githubUserId,
        updatedByLogin: params.session.user.login,
        updatedAt: new Date()
      }
    });
}

async function ensureDropboxSignIntegration(
  params: { db: DbClient; config: AppConfig },
  repositoryId: string,
  session: CurrentSession
) {
  const existing = await getDropboxSignIntegration(params.db, repositoryId);
  const accountApiKey = await resolveDropboxApiKey(
    params.db,
    params.config,
    session.user.githubUserId
  );

  if (!accountApiKey) {
    return existing;
  }

  if (existing) {
    try {
      if (
        decryptSigningCredential(params.config, existing.encryptedApiKey) === accountApiKey
      ) {
        return existing;
      }
    } catch {
      // Refresh when the stored integration key cannot be decrypted.
    }
  }

  await saveDropboxSignIntegration({
    db: params.db,
    config: params.config,
    repositoryId,
    apiKey: accountApiKey,
    session
  });
  return getDropboxSignIntegration(params.db, repositoryId);
}

async function saveDropboxSignIntegration(params: {
  db: DbClient;
  config: AppConfig;
  repositoryId: string;
  apiKey?: string;
  session: CurrentSession;
}): Promise<void> {
  const existing = await getDropboxSignIntegration(params.db, params.repositoryId);
  const resolvedApiKey = await resolveDropboxApiKey(
    params.db,
    params.config,
    params.session.user.githubUserId,
    params.apiKey
  );

  if (!resolvedApiKey && !existing) {
    throw new Error(
      "Dropbox Sign API key is required. Import a Dropbox template with your API key first."
    );
  }

  if (params.apiKey) {
    await saveUserDropboxSignCredential(
      params.db,
      params.config,
      params.session.user.githubUserId,
      params.apiKey
    );
  }

  const integrationId = createId("signint");
  const encryptedApiKey = resolvedApiKey
    ? encryptSigningCredential(params.config, resolvedApiKey)
    : existing!.encryptedApiKey;
  const apiKeyLast4 = resolvedApiKey ? keySuffix(resolvedApiKey) : existing!.apiKeyLast4;

  await params.db
    .insert(signingProviderIntegrations)
    .values({
      signingProviderIntegrationId: integrationId,
      repositoryId: params.repositoryId,
      provider: "dropbox_sign",
      encryptedApiKey,
      apiKeyLast4,
      createdByGithubUserId: params.session.user.githubUserId,
      createdByLogin: params.session.user.login,
      updatedByGithubUserId: params.session.user.githubUserId,
      updatedByLogin: params.session.user.login
    })
    .onConflictDoUpdate({
      target: [signingProviderIntegrations.repositoryId, signingProviderIntegrations.provider],
      set: {
        encryptedApiKey,
        apiKeyLast4,
        updatedByGithubUserId: params.session.user.githubUserId,
        updatedByLogin: params.session.user.login,
        updatedAt: new Date()
      }
    });
}

function keySuffix(value: string): string {
  return value.slice(-4);
}

async function listSignatureRecords(
  db: DbClient,
  repositoryId: string
): Promise<{
  signatures: SignatureRecord[];
  pullRequestChecks: PullRequestCoverage[];
}> {
  const documents = await db.query.claDocuments.findMany({
    where: (table) => eq(table.repositoryId, repositoryId)
  });
  const documentsById = new Map(documents.map((document) => [document.claDocumentId, document]));
  const documentIds = documents.map((document) => document.claDocumentId);

  const [personalRows, corporateRows, checkRows] = await Promise.all([
    documentIds.length
      ? db.query.personalSignatures.findMany({
          where: (table) => inArray(table.claDocumentId, documentIds)
        })
      : [],
    documentIds.length
      ? db.query.corporateAgreements.findMany({
          where: (table) => inArray(table.claDocumentId, documentIds)
        })
      : [],
    db.query.pullRequestChecks.findMany({
      where: (table) => eq(table.repositoryId, repositoryId)
    })
  ]);

  return {
    signatures: [
      ...personalRows.map((row) => {
        const ctx = signatureDocumentContext(documentsById, row.claDocumentId);
        return {
          kind: "personal" as const,
          signerLogin: row.signerLogin,
          githubUserId: row.githubUserId,
          organizationLogin: null,
          claVersionHash: row.claVersionHash,
          signedAt: row.signedAt.toISOString(),
          revokedAt: row.revokedAt?.toISOString() ?? null,
          documentSource: ctx.documentSource,
          documentLabel: ctx.documentLabel
        };
      }),
      ...corporateRows.map((row) => {
        const ctx = signatureDocumentContext(documentsById, row.claDocumentId);
        return {
          kind: "corporate" as const,
          signerLogin: row.authorizedSignerLogin,
          githubUserId: row.authorizedSignerUserId,
          organizationLogin: row.orgLogin,
          claVersionHash: row.claVersionHash,
          signedAt: row.effectiveFrom.toISOString(),
          revokedAt: row.effectiveUntil?.toISOString() ?? null,
          documentSource: ctx.documentSource,
          documentLabel: ctx.documentLabel
        };
      })
    ],
    pullRequestChecks: checkRows.map((row) => ({
      repositoryId: row.repositoryId,
      pullNumber: row.pullNumber,
      headSha: row.headSha,
      conclusion: row.conclusion,
      detailsUrl: row.detailsUrl,
      lastSummary: row.lastSummary,
      updatedAt: row.updatedAt.toISOString()
    }))
  };
}

function signatureDocumentContext(
  documentsById: Map<string, ClaDocument>,
  claDocumentId: string
): { documentSource: SignatureRecord["documentSource"]; documentLabel: string } {
  const document = documentsById.get(claDocumentId);
  if (!document) {
    return {
      documentSource: "managed_template",
      documentLabel: "Unknown agreement document"
    };
  }

  if (document.source === "repository") {
    return { documentSource: "repository", documentLabel: document.path ?? "CLA.md" };
  }
  if (document.source === "default_template") {
    return {
      documentSource: "default_template",
      documentLabel: document.templateName ?? "Platform default (fallback)"
    };
  }
  return {
    documentSource: "managed_template",
    documentLabel: document.templateName ?? "Managed template"
  };
}

function signingProviderErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Signing provider request failed";
}

function toAdminRepository(
  repository: typeof repositories.$inferSelect,
  adminPermission: boolean,
  stats?: AdminRepository["stats"]
): AdminRepository {
  return {
    repositoryId: repository.repositoryId,
    installationId: repository.installationId,
    owner: repository.owner,
    name: repository.name,
    fullName: repository.fullName,
    private: repository.private,
    defaultBranch: repository.defaultBranch,
    adminPermission,
    stats: stats ?? null
  };
}

async function getRepositoryStats(
  db: DbClient,
  repositoryId: string
): Promise<NonNullable<AdminRepository["stats"]>> {
  const settings = await db.query.repositoryTemplateSettings.findFirst({
    where: (table) => eq(table.repositoryId, repositoryId)
  });
  const signingSettings = await db.query.repositorySigningSettings.findFirst({
    where: (table) => eq(table.repositoryId, repositoryId)
  });

  let selectedTemplateName: string | null = null;
  if (settings?.mode === "managed" && settings.claTemplateVersionId) {
    const version = await db.query.claTemplateVersions.findFirst({
      where: (table) => eq(table.claTemplateVersionId, settings.claTemplateVersionId!)
    });
    if (version) {
      const template = await db.query.claTemplates.findFirst({
        where: (table) => eq(table.claTemplateId, version.claTemplateId)
      });
      selectedTemplateName = template?.name ?? null;
    }
  }

  const documents = await db.query.claDocuments.findMany({
    where: (table) => eq(table.repositoryId, repositoryId)
  });
  const documentIds = documents.map((document) => document.claDocumentId);

  const [personalRows, corporateRows, checkRows] = await Promise.all([
    documentIds.length
      ? db.query.personalSignatures.findMany({
          where: (table) => inArray(table.claDocumentId, documentIds)
        })
      : Promise.resolve([]),
    documentIds.length
      ? db.query.corporateAgreements.findMany({
          where: (table) => inArray(table.claDocumentId, documentIds)
        })
      : Promise.resolve([]),
    db.query.pullRequestChecks.findMany({
      where: (table) => eq(table.repositoryId, repositoryId)
    })
  ]);

  const activityDates: Date[] = [];
  for (const row of personalRows) activityDates.push(row.signedAt);
  for (const row of corporateRows) activityDates.push(row.effectiveFrom);
  for (const row of checkRows) activityDates.push(row.updatedAt);

  const lastActivityAt = activityDates.length
    ? new Date(Math.max(...activityDates.map((date) => date.getTime())))
    : null;

  return {
    templateMode: settings?.mode === "managed" ? "managed" : "repository",
    signingMode: signingSettings?.signingMode ?? "simple",
    selectedTemplateName,
    signatureCount: personalRows.length + corporateRows.length,
    pullRequestCheckCount: checkRows.length,
    lastActivityAt: lastActivityAt ? lastActivityAt.toISOString() : null
  };
}

function compareByCreatedAtDesc(
  left: { createdAt: Date },
  right: { createdAt: Date }
): number {
  return right.createdAt.getTime() - left.createdAt.getTime();
}

function normalizeAccountType(accountType: string): "Organization" | "User" {
  return accountType === "User" ? "User" : "Organization";
}
