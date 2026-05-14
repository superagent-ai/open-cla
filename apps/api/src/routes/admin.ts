import type { App } from "@octokit/app";
import {
  CreateTemplateRequestSchema,
  SelectTemplateRequestSchema,
  type AdminInstallation,
  type AdminRepository,
  type PullRequestCoverage,
  type RepositoryTemplateSettings,
  type SignatureRecord,
  type TemplateSummary,
  type TemplateVersion
} from "@superagent-cla/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { AppConfig } from "../config.js";
import type { DbClient } from "../db/client.js";
import {
  claDocuments,
  claTemplates,
  claTemplateVersions,
  corporateAgreements,
  personalSignatures,
  pullRequestChecks,
  repositories,
  repositoryTemplateSettings,
  type ClaTemplate,
  type ClaTemplateVersion
} from "../db/schema.js";
import { getDefaultTemplate } from "../cla/templates.js";
import { getInstallationOctokit } from "../github/app.js";
import { createId } from "../utils/ids.js";
import { sha256 } from "../utils/sha.js";
import { getCurrentSession, type CurrentSession } from "./session.js";

type AdminRepositoryContext = {
  session: CurrentSession;
  repository: typeof repositories.$inferSelect;
};

export async function registerAdminRoutes(
  app: FastifyInstance,
  params: {
    db: DbClient;
    githubApp: App;
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

    const installableRepositories: AdminRepository[] = [];
    for (const repository of allRepositories) {
      const adminPermission = await canAdminRepository({
        githubApp: params.githubApp,
        repository,
        login: session.user.login
      });
      if (!adminPermission) {
        continue;
      }

      installableRepositories.push(toAdminRepository(repository, true));
    }

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
      defaultTemplateName: params.config.DEFAULT_CLA_TEMPLATE_NAME
    });
    const settings = await getRepositoryTemplateSettings(params.db, repositoryId);

    return {
      repository: toAdminRepository(context.repository, true),
      settings,
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
    const versionHash = sha256(body.body);

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
        body: body.body,
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
      template: await toTemplateSummary(params.db, {
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

    if (body.templateVersionId) {
      await assertTemplateVersionSelectable(params.db, repositoryId, body.templateVersionId);
    }

    await selectTemplateVersion({
      db: params.db,
      repositoryId,
      templateVersionId: body.templateVersionId,
      session: context.session
    });

    return {
      settings: await getRepositoryTemplateSettings(params.db, repositoryId)
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
    githubApp: App;
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

  const adminPermission = await canAdminRepository({
    githubApp: params.githubApp,
    repository,
    login: session.user.login
  });
  if (!adminPermission) {
    reply.code(403).send({ error: "Repository admin access required" });
    return null;
  }

  return { session, repository };
}

async function canAdminRepository(params: {
  githubApp: App;
  repository: typeof repositories.$inferSelect;
  login: string;
}): Promise<boolean> {
  try {
    const octokit = await getInstallationOctokit(
      params.githubApp,
      params.repository.installationId
    );
    const response = await octokit.request<{ permission: string }>(
      "GET /repos/{owner}/{repo}/collaborators/{username}/permission",
      {
        owner: params.repository.owner,
        repo: params.repository.name,
        username: params.login
      }
    );

    return response.data.permission === "admin";
  } catch (error) {
    if (isNotFoundError(error)) {
      return false;
    }

    throw error;
  }
}

async function listTemplatesForRepository(
  db: DbClient,
  params: {
    repositoryId: string;
    defaultTemplateName: string;
  }
): Promise<TemplateSummary[]> {
  const defaultTemplate = await ensureDefaultTemplate(db, params.defaultTemplateName);
  const uploadedTemplates = await db.query.claTemplates.findMany({
    where: (table) => eq(table.repositoryId, params.repositoryId)
  });

  const templates = [defaultTemplate, ...uploadedTemplates];
  return Promise.all(templates.map((template) => toTemplateSummary(db, template)));
}

async function ensureDefaultTemplate(
  db: DbClient,
  defaultTemplateName: string
): Promise<ClaTemplate> {
  const defaultTemplate = getDefaultTemplate(defaultTemplateName);
  const existing = await db.query.claTemplates.findFirst({
    where: (table) =>
      and(eq(table.source, "default"), eq(table.name, defaultTemplate.name), isNull(table.repositoryId))
  });
  const template = existing ?? (await createDefaultTemplate(db, defaultTemplate));

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
  template: { name: string; title: string; body: string }
): Promise<ClaTemplate> {
  const [created] = await db
    .insert(claTemplates)
    .values({
      claTemplateId: createId("tmpl"),
      repositoryId: null,
      source: "default",
      name: template.name,
      description: "Bundled default CLA template"
    })
    .returning();

  if (!created) {
    throw new Error("Failed to create default template");
  }

  return created;
}

async function toTemplateSummary(
  db: DbClient,
  template: ClaTemplate
): Promise<TemplateSummary> {
  const versions = await db.query.claTemplateVersions.findMany({
    where: (table) => eq(table.claTemplateId, template.claTemplateId)
  });
  const latestVersion = versions.sort(compareByCreatedAtDesc)[0] ?? null;

  return {
    templateId: template.claTemplateId,
    name: template.name,
    description: template.description,
    source: template.source,
    latestVersion: latestVersion ? toTemplateVersion(latestVersion) : null
  };
}

function toTemplateVersion(version: ClaTemplateVersion): TemplateVersion {
  return {
    templateVersionId: version.claTemplateVersionId,
    templateId: version.claTemplateId,
    title: version.title,
    versionHash: version.versionHash,
    body: version.body,
    createdByLogin: version.createdByLogin,
    createdAt: version.createdAt.toISOString()
  };
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

async function assertTemplateVersionSelectable(
  db: DbClient,
  repositoryId: string,
  templateVersionId: string
): Promise<void> {
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
      ...personalRows.map((row) => ({
        kind: "personal" as const,
        signerLogin: row.signerLogin,
        githubUserId: row.githubUserId,
        organizationLogin: null,
        claVersionHash: row.claVersionHash,
        signedAt: row.signedAt.toISOString(),
        revokedAt: row.revokedAt?.toISOString() ?? null
      })),
      ...corporateRows.map((row) => ({
        kind: "corporate" as const,
        signerLogin: row.authorizedSignerLogin,
        githubUserId: row.authorizedSignerUserId,
        organizationLogin: row.orgLogin,
        claVersionHash: row.claVersionHash,
        signedAt: row.effectiveFrom.toISOString(),
        revokedAt: row.effectiveUntil?.toISOString() ?? null
      }))
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

function toAdminRepository(
  repository: typeof repositories.$inferSelect,
  adminPermission: boolean
): AdminRepository {
  return {
    repositoryId: repository.repositoryId,
    installationId: repository.installationId,
    owner: repository.owner,
    name: repository.name,
    fullName: repository.fullName,
    private: repository.private,
    defaultBranch: repository.defaultBranch,
    adminPermission
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

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    Number((error as { status?: unknown }).status) === 404
  );
}
