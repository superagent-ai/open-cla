import { z } from "zod";

export const GitHubAccountTypeSchema = z.enum(["Organization", "User"]);
export type GitHubAccountType = z.infer<typeof GitHubAccountTypeSchema>;

export const AdminUserSchema = z.object({
  githubUserId: z.string(),
  login: z.string(),
  avatarUrl: z.string().nullable()
});
export type AdminUser = z.infer<typeof AdminUserSchema>;

export const AdminRepositorySchema = z.object({
  repositoryId: z.string(),
  installationId: z.string(),
  owner: z.string(),
  name: z.string(),
  fullName: z.string(),
  private: z.boolean(),
  defaultBranch: z.string(),
  adminPermission: z.boolean()
});
export type AdminRepository = z.infer<typeof AdminRepositorySchema>;

export const AdminInstallationSchema = z.object({
  installationId: z.string(),
  accountId: z.string(),
  accountLogin: z.string(),
  accountType: GitHubAccountTypeSchema,
  repositories: z.array(AdminRepositorySchema)
});
export type AdminInstallation = z.infer<typeof AdminInstallationSchema>;

export const TemplateSourceSchema = z.enum(["default", "uploaded"]);
export type TemplateSource = z.infer<typeof TemplateSourceSchema>;

export const TemplateVersionSchema = z.object({
  templateVersionId: z.string(),
  templateId: z.string(),
  title: z.string(),
  versionHash: z.string(),
  body: z.string(),
  createdByLogin: z.string().nullable(),
  createdAt: z.string()
});
export type TemplateVersion = z.infer<typeof TemplateVersionSchema>;

export const TemplateSummarySchema = z.object({
  templateId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  source: TemplateSourceSchema,
  latestVersion: TemplateVersionSchema.nullable()
});
export type TemplateSummary = z.infer<typeof TemplateSummarySchema>;

export const RepositoryTemplateSettingsSchema = z.object({
  repositoryId: z.string(),
  mode: z.enum(["repository", "managed"]),
  selectedTemplateVersionId: z.string().nullable(),
  selectedTemplateName: z.string().nullable(),
  selectedTemplateHash: z.string().nullable(),
  updatedByLogin: z.string().nullable(),
  updatedAt: z.string().nullable()
});
export type RepositoryTemplateSettings = z.infer<typeof RepositoryTemplateSettingsSchema>;

export const TemplatesResponseSchema = z.object({
  repository: AdminRepositorySchema,
  settings: RepositoryTemplateSettingsSchema,
  templates: z.array(TemplateSummarySchema)
});
export type TemplatesResponse = z.infer<typeof TemplatesResponseSchema>;

export const CreateTemplateRequestSchema = z.object({
  repositoryId: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1)
});
export type CreateTemplateRequest = z.infer<typeof CreateTemplateRequestSchema>;

export const SelectTemplateRequestSchema = z.object({
  repositoryId: z.string().min(1),
  templateVersionId: z.string().min(1).nullable()
});
export type SelectTemplateRequest = z.infer<typeof SelectTemplateRequestSchema>;

export const SignatureRecordSchema = z.object({
  kind: z.enum(["personal", "corporate"]),
  signerLogin: z.string(),
  githubUserId: z.string().nullable(),
  organizationLogin: z.string().nullable(),
  claVersionHash: z.string(),
  signedAt: z.string(),
  revokedAt: z.string().nullable()
});
export type SignatureRecord = z.infer<typeof SignatureRecordSchema>;

export const PullRequestCoverageSchema = z.object({
  repositoryId: z.string(),
  pullNumber: z.number(),
  headSha: z.string(),
  conclusion: z.string().nullable(),
  detailsUrl: z.string().nullable(),
  lastSummary: z.string().nullable(),
  updatedAt: z.string()
});
export type PullRequestCoverage = z.infer<typeof PullRequestCoverageSchema>;

export const SignaturesResponseSchema = z.object({
  repository: AdminRepositorySchema,
  signatures: z.array(SignatureRecordSchema),
  pullRequestChecks: z.array(PullRequestCoverageSchema)
});
export type SignaturesResponse = z.infer<typeof SignaturesResponseSchema>;
