import { customType } from "drizzle-orm/pg-core";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  }
});

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
};

export const claDocumentSource = pgEnum("cla_document_source", [
  "repository",
  "default_template",
  "managed_template"
]);

export const claContentFormat = pgEnum("cla_content_format", [
  "markdown",
  "pdf",
  "dropbox_template"
]);

export const claTemplateSource = pgEnum("cla_template_source", [
  "default",
  "uploaded",
  "dropbox_sign"
]);

export const repositoryTemplateMode = pgEnum("repository_template_mode", [
  "repository",
  "managed"
]);

export const repositorySigningMode = pgEnum("repository_signing_mode", [
  "simple",
  "dropbox_sign"
]);

export const signatureRequestKind = pgEnum("signature_request_kind", [
  "personal",
  "corporate"
]);

export const signatureProvider = pgEnum("signature_provider", [
  "dropbox_sign"
]);

export const signatureRequestStatus = pgEnum("signature_request_status", [
  "pending",
  "signed",
  "completed",
  "declined",
  "expired",
  "failed"
]);

export const checkConclusion = pgEnum("check_conclusion", [
  "success",
  "failure",
  "neutral",
  "cancelled",
  "skipped",
  "timed_out",
  "action_required"
]);

export const githubUsers = pgTable("github_users", {
  githubUserId: text("github_user_id").primaryKey(),
  login: text("login").notNull(),
  avatarUrl: text("avatar_url"),
  ...timestamps
});

export const userSessions = pgTable(
  "user_sessions",
  {
    sessionId: text("session_id").primaryKey(),
    githubUserId: text("github_user_id")
      .notNull()
      .references(() => githubUsers.githubUserId, { onDelete: "cascade" }),
    accessToken: text("access_token").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => ({
    userIdx: index("user_sessions_user_idx").on(table.githubUserId)
  })
);

export const installations = pgTable("installations", {
  installationId: text("installation_id").primaryKey(),
  accountId: text("account_id").notNull(),
  accountLogin: text("account_login").notNull(),
  accountType: text("account_type").notNull(),
  permissions: jsonb("permissions").$type<Record<string, string>>(),
  ...timestamps
});

export const repositories = pgTable(
  "repositories",
  {
    repositoryId: text("repository_id").primaryKey(),
    installationId: text("installation_id")
      .notNull()
      .references(() => installations.installationId, { onDelete: "cascade" }),
    owner: text("owner").notNull(),
    name: text("name").notNull(),
    fullName: text("full_name").notNull(),
    defaultBranch: text("default_branch").notNull(),
    private: boolean("private").notNull().default(false),
    ...timestamps
  },
  (table) => ({
    ownerNameUnique: uniqueIndex("repositories_owner_name_unique").on(table.owner, table.name),
    installationIdx: index("repositories_installation_idx").on(table.installationId)
  })
);

export const claDocuments = pgTable(
  "cla_documents",
  {
    claDocumentId: text("cla_document_id").primaryKey(),
    repositoryId: text("repository_id").references(() => repositories.repositoryId, {
      onDelete: "cascade"
    }),
    source: claDocumentSource("source").notNull(),
    templateName: text("template_name"),
    path: text("path"),
    gitSha: text("git_sha"),
    versionHash: text("version_hash").notNull(),
    body: text("body").notNull().default(""),
    contentFormat: claContentFormat("content_format").notNull().default("markdown"),
    pdfUrl: text("pdf_url"),
    pdfData: bytea("pdf_data"),
    dropboxTemplateId: text("dropbox_template_id"),
    dropboxSignerRole: text("dropbox_signer_role"),
    ...timestamps
  },
  (table) => ({
    hashIdx: index("cla_documents_hash_idx").on(table.versionHash),
    repoHashUnique: uniqueIndex("cla_documents_repo_hash_unique").on(
      table.repositoryId,
      table.versionHash
    )
  })
);

export const claTemplates = pgTable(
  "cla_templates",
  {
    claTemplateId: text("cla_template_id").primaryKey(),
    repositoryId: text("repository_id").references(() => repositories.repositoryId, {
      onDelete: "cascade"
    }),
    source: claTemplateSource("source").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    createdByGithubUserId: text("created_by_github_user_id").references(
      () => githubUsers.githubUserId,
      { onDelete: "set null" }
    ),
    createdByLogin: text("created_by_login"),
    ...timestamps
  },
  (table) => ({
    repositoryIdx: index("cla_templates_repository_idx").on(table.repositoryId),
    sourceNameIdx: index("cla_templates_source_name_idx").on(table.source, table.name)
  })
);

export const claTemplateVersions = pgTable(
  "cla_template_versions",
  {
    claTemplateVersionId: text("cla_template_version_id").primaryKey(),
    claTemplateId: text("cla_template_id")
      .notNull()
      .references(() => claTemplates.claTemplateId, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    contentFormat: claContentFormat("content_format").notNull().default("markdown"),
    pdfUrl: text("pdf_url"),
    pdfFileName: text("pdf_file_name"),
    pdfData: bytea("pdf_data"),
    dropboxTemplateId: text("dropbox_template_id"),
    dropboxSignerRole: text("dropbox_signer_role"),
    dropboxTemplateSnapshot: jsonb("dropbox_template_snapshot").$type<Record<string, unknown>>(),
    versionHash: text("version_hash").notNull(),
    createdByGithubUserId: text("created_by_github_user_id").references(
      () => githubUsers.githubUserId,
      { onDelete: "set null" }
    ),
    createdByLogin: text("created_by_login"),
    ...timestamps
  },
  (table) => ({
    templateHashUnique: uniqueIndex("cla_template_versions_template_hash_unique").on(
      table.claTemplateId,
      table.versionHash
    ),
    hashIdx: index("cla_template_versions_hash_idx").on(table.versionHash)
  })
);

export const repositoryTemplateSettings = pgTable("repository_template_settings", {
  repositoryId: text("repository_id")
    .primaryKey()
    .references(() => repositories.repositoryId, { onDelete: "cascade" }),
  mode: repositoryTemplateMode("mode").notNull().default("repository"),
  claTemplateVersionId: text("cla_template_version_id").references(
    () => claTemplateVersions.claTemplateVersionId,
    { onDelete: "set null" }
  ),
  updatedByGithubUserId: text("updated_by_github_user_id").references(
    () => githubUsers.githubUserId,
    { onDelete: "set null" }
  ),
  updatedByLogin: text("updated_by_login"),
  ...timestamps
});

export const userSigningProviderCredentials = pgTable(
  "user_signing_provider_credentials",
  {
    credentialId: text("credential_id").primaryKey(),
    githubUserId: text("github_user_id")
      .notNull()
      .references(() => githubUsers.githubUserId, { onDelete: "cascade" }),
    provider: signatureProvider("provider").notNull(),
    encryptedApiKey: text("encrypted_api_key").notNull(),
    apiKeyLast4: text("api_key_last4"),
    ...timestamps
  },
  (table) => ({
    userProviderUnique: uniqueIndex("user_signing_provider_credentials_user_provider_unique").on(
      table.githubUserId,
      table.provider
    )
  })
);

export const signingProviderIntegrations = pgTable(
  "signing_provider_integrations",
  {
    signingProviderIntegrationId: text("signing_provider_integration_id").primaryKey(),
    repositoryId: text("repository_id")
      .notNull()
      .references(() => repositories.repositoryId, { onDelete: "cascade" }),
    provider: signatureProvider("provider").notNull(),
    encryptedApiKey: text("encrypted_api_key").notNull(),
    apiKeyLast4: text("api_key_last4"),
    createdByGithubUserId: text("created_by_github_user_id").references(
      () => githubUsers.githubUserId,
      { onDelete: "set null" }
    ),
    createdByLogin: text("created_by_login"),
    updatedByGithubUserId: text("updated_by_github_user_id").references(
      () => githubUsers.githubUserId,
      { onDelete: "set null" }
    ),
    updatedByLogin: text("updated_by_login"),
    ...timestamps
  },
  (table) => ({
    repositoryProviderUnique: uniqueIndex("signing_provider_integrations_repo_provider_unique").on(
      table.repositoryId,
      table.provider
    )
  })
);

export const repositorySigningSettings = pgTable("repository_signing_settings", {
  repositoryId: text("repository_id")
    .primaryKey()
    .references(() => repositories.repositoryId, { onDelete: "cascade" }),
  signingMode: repositorySigningMode("signing_mode").notNull().default("simple"),
  signingProviderIntegrationId: text("signing_provider_integration_id").references(
    () => signingProviderIntegrations.signingProviderIntegrationId,
    { onDelete: "set null" }
  ),
  updatedByGithubUserId: text("updated_by_github_user_id").references(
    () => githubUsers.githubUserId,
    { onDelete: "set null" }
  ),
  updatedByLogin: text("updated_by_login"),
  ...timestamps
});

export const personalSignatures = pgTable(
  "personal_signatures",
  {
    signatureId: text("signature_id").primaryKey(),
    githubUserId: text("github_user_id")
      .notNull()
      .references(() => githubUsers.githubUserId, { onDelete: "cascade" }),
    claDocumentId: text("cla_document_id")
      .notNull()
      .references(() => claDocuments.claDocumentId, { onDelete: "cascade" }),
    claVersionHash: text("cla_version_hash").notNull(),
    signerLogin: text("signer_login").notNull(),
    signerIp: text("signer_ip"),
    userAgent: text("user_agent"),
    signedAt: timestamp("signed_at", { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => ({
    userHashUnique: uniqueIndex("personal_signatures_user_hash_unique").on(
      table.githubUserId,
      table.claVersionHash
    ),
    hashIdx: index("personal_signatures_hash_idx").on(table.claVersionHash)
  })
);

export const corporateAgreements = pgTable(
  "corporate_agreements",
  {
    corporateAgreementId: text("corporate_agreement_id").primaryKey(),
    orgId: text("org_id").notNull(),
    orgLogin: text("org_login").notNull(),
    claDocumentId: text("cla_document_id")
      .notNull()
      .references(() => claDocuments.claDocumentId, { onDelete: "cascade" }),
    claVersionHash: text("cla_version_hash").notNull(),
    authorizedSignerUserId: text("authorized_signer_user_id")
      .notNull()
      .references(() => githubUsers.githubUserId, { onDelete: "restrict" }),
    authorizedSignerLogin: text("authorized_signer_login").notNull(),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }).defaultNow().notNull(),
    effectiveUntil: timestamp("effective_until", { withTimezone: true }),
    notes: text("notes"),
    ...timestamps
  },
  (table) => ({
    orgHashUnique: uniqueIndex("corporate_agreements_org_hash_unique").on(
      table.orgId,
      table.claVersionHash
    ),
    hashIdx: index("corporate_agreements_hash_idx").on(table.claVersionHash)
  })
);

export const signatureRequests = pgTable(
  "signature_requests",
  {
    signatureRequestId: text("signature_request_id").primaryKey(),
    kind: signatureRequestKind("kind").notNull(),
    provider: signatureProvider("provider").notNull(),
    status: signatureRequestStatus("status").notNull().default("pending"),
    signingProviderIntegrationId: text("signing_provider_integration_id")
      .notNull()
      .references(() => signingProviderIntegrations.signingProviderIntegrationId, {
        onDelete: "restrict"
      }),
    repositoryId: text("repository_id")
      .notNull()
      .references(() => repositories.repositoryId, { onDelete: "cascade" }),
    githubUserId: text("github_user_id")
      .notNull()
      .references(() => githubUsers.githubUserId, { onDelete: "cascade" }),
    signerLogin: text("signer_login").notNull(),
    signerEmail: text("signer_email").notNull(),
    orgId: text("org_id"),
    orgLogin: text("org_login"),
    claDocumentId: text("cla_document_id")
      .notNull()
      .references(() => claDocuments.claDocumentId, { onDelete: "cascade" }),
    claVersionHash: text("cla_version_hash").notNull(),
    owner: text("owner").notNull(),
    repo: text("repo").notNull(),
    pull: text("pull"),
    sha: text("sha"),
    providerRequestId: text("provider_request_id"),
    providerSignatureId: text("provider_signature_id"),
    providerSignUrlExpiresAt: timestamp("provider_sign_url_expires_at", { withTimezone: true }),
    auditTrailUrl: text("audit_trail_url"),
    signedDocumentUrl: text("signed_document_url"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    providerPayload: jsonb("provider_payload").$type<Record<string, unknown>>(),
    ...timestamps
  },
  (table) => ({
    providerRequestUnique: uniqueIndex("signature_requests_provider_request_unique").on(
      table.provider,
      table.providerRequestId
    ),
    providerSignatureIdx: index("signature_requests_provider_signature_idx").on(table.providerSignatureId),
    repositoryStatusIdx: index("signature_requests_repository_status_idx").on(
      table.repositoryId,
      table.status
    ),
    userHashIdx: index("signature_requests_user_hash_idx").on(table.githubUserId, table.claVersionHash)
  })
);

export const orgMembershipCache = pgTable(
  "org_membership_cache",
  {
    orgId: text("org_id").notNull(),
    orgLogin: text("org_login").notNull(),
    githubUserId: text("github_user_id").notNull(),
    userLogin: text("user_login").notNull(),
    active: boolean("active").notNull(),
    source: text("source").notNull(),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }).defaultNow().notNull(),
    ...timestamps
  },
  (table) => ({
    pk: primaryKey({ columns: [table.orgId, table.githubUserId] }),
    userIdx: index("org_membership_cache_user_idx").on(table.githubUserId)
  })
);

export const pullRequestChecks = pgTable(
  "pull_request_checks",
  {
    repositoryId: text("repository_id")
      .notNull()
      .references(() => repositories.repositoryId, { onDelete: "cascade" }),
    pullNumber: integer("pull_number").notNull(),
    headSha: text("head_sha").notNull(),
    checkRunId: text("check_run_id"),
    conclusion: checkConclusion("conclusion"),
    detailsUrl: text("details_url"),
    lastSummary: text("last_summary"),
    ...timestamps
  },
  (table) => ({
    pk: primaryKey({ columns: [table.repositoryId, table.pullNumber, table.headSha] }),
    repoPrIdx: index("pull_request_checks_repo_pr_idx").on(table.repositoryId, table.pullNumber)
  })
);

export type GitHubUser = typeof githubUsers.$inferSelect;
export type ClaDocument = typeof claDocuments.$inferSelect;
export type ClaTemplate = typeof claTemplates.$inferSelect;
export type ClaTemplateVersion = typeof claTemplateVersions.$inferSelect;
export type RepositoryTemplateSettings = typeof repositoryTemplateSettings.$inferSelect;
export type RepositorySigningSettings = typeof repositorySigningSettings.$inferSelect;
export type SigningProviderIntegration = typeof signingProviderIntegrations.$inferSelect;
export type UserSigningProviderCredential = typeof userSigningProviderCredentials.$inferSelect;
export type CorporateAgreement = typeof corporateAgreements.$inferSelect;
export type PersonalSignature = typeof personalSignatures.$inferSelect;
export type SignatureRequest = typeof signatureRequests.$inferSelect;
