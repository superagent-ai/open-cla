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

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
};

export const claDocumentSource = pgEnum("cla_document_source", [
  "repository",
  "default_template"
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
    body: text("body").notNull(),
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
export type CorporateAgreement = typeof corporateAgreements.$inferSelect;
export type PersonalSignature = typeof personalSignatures.$inferSelect;
