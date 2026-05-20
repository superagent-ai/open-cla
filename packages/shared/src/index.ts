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
  adminPermission: z.boolean(),
  stats: z
    .object({
      templateMode: z.enum(["repository", "managed"]),
      signingMode: z.enum(["simple", "dropbox_sign"]),
      selectedTemplateName: z.string().nullable(),
      signatureCount: z.number(),
      pullRequestCheckCount: z.number(),
      lastActivityAt: z.string().nullable()
    })
    .nullable()
    .optional()
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

export const TemplateSourceSchema = z.enum(["default", "uploaded", "dropbox_sign"]);
export type TemplateSource = z.infer<typeof TemplateSourceSchema>;

export const ClaContentFormatSchema = z.enum(["markdown", "pdf", "dropbox_template"]);
export type ClaContentFormat = z.infer<typeof ClaContentFormatSchema>;

export const DropboxTemplateSnapshotSchema = z.object({
  title: z.string().nullable(),
  signerRoles: z.array(z.string())
});
export type DropboxTemplateSnapshot = z.infer<typeof DropboxTemplateSnapshotSchema>;

export const TemplateVersionSchema = z.object({
  templateVersionId: z.string(),
  templateId: z.string(),
  title: z.string(),
  versionHash: z.string(),
  contentFormat: ClaContentFormatSchema,
  body: z.string(),
  pdfUrl: z.string().nullable(),
  pdfFileName: z.string().nullable(),
  dropboxTemplateId: z.string().nullable(),
  dropboxSignerRole: z.string().nullable(),
  dropboxTemplateSnapshot: DropboxTemplateSnapshotSchema.nullable(),
  createdByLogin: z.string().nullable(),
  createdAt: z.string()
});
export type TemplateVersion = z.infer<typeof TemplateVersionSchema>;

export const TemplateSummarySchema = z.object({
  templateId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  source: TemplateSourceSchema,
  repositoryId: z.string().nullable(),
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

export const RepositorySigningModeSchema = z.enum(["simple", "dropbox_sign"]);
export type RepositorySigningMode = z.infer<typeof RepositorySigningModeSchema>;

export const RepositorySigningSettingsSchema = z.object({
  repositoryId: z.string(),
  signingMode: RepositorySigningModeSchema,
  dropboxSignConfigured: z.boolean(),
  dropboxSignApiKeyLast4: z.string().nullable(),
  accountDropboxSignApiKeyLast4: z.string().nullable(),
  dropboxSignCallbackUrl: z.string(),
  updatedByLogin: z.string().nullable(),
  updatedAt: z.string().nullable()
});
export type RepositorySigningSettings = z.infer<typeof RepositorySigningSettingsSchema>;

export const TemplatesResponseSchema = z.object({
  repository: AdminRepositorySchema,
  settings: RepositoryTemplateSettingsSchema,
  signingSettings: RepositorySigningSettingsSchema,
  templates: z.array(TemplateSummarySchema)
});
export type TemplatesResponse = z.infer<typeof TemplatesResponseSchema>;

const pdfUploadFields = {
  pdfFileName: z.string().trim().min(1).max(255),
  pdfBase64: z.string().min(1)
};

export const CreateTemplateRequestSchema = z.object({
  repositoryId: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  title: z.string().trim().min(1).max(200),
  ...pdfUploadFields
});
export type CreateTemplateRequest = z.infer<typeof CreateTemplateRequestSchema>;

export const GlobalTemplateSummarySchema = TemplateSummarySchema.extend({
  createdByLogin: z.string().nullable(),
  createdAt: z.string(),
  isMine: z.boolean()
});
export type GlobalTemplateSummary = z.infer<typeof GlobalTemplateSummarySchema>;

export const GlobalTemplatesResponseSchema = z.object({
  templates: z.array(GlobalTemplateSummarySchema)
});
export type GlobalTemplatesResponse = z.infer<typeof GlobalTemplatesResponseSchema>;

export const CreateGlobalTemplateRequestSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  title: z.string().trim().min(1).max(200),
  ...pdfUploadFields
});
export type CreateGlobalTemplateRequest = z.infer<typeof CreateGlobalTemplateRequestSchema>;

export const ImportDropboxTemplateRequestSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  dropboxTemplateId: z.string().trim().min(1).max(255),
  dropboxApiKey: z.string().trim().min(1).optional(),
  signerRole: z.string().trim().min(1).max(120).optional()
});
export type ImportDropboxTemplateRequest = z.infer<typeof ImportDropboxTemplateRequestSchema>;

export const TemplateDetailResponseSchema = z.object({
  template: GlobalTemplateSummarySchema,
  contentFormat: ClaContentFormatSchema,
  body: z.string(),
  pdfUrl: z.string().nullable(),
  pdfFileName: z.string().nullable()
});
export type TemplateDetailResponse = z.infer<typeof TemplateDetailResponseSchema>;

export const KnownGitHubUserSchema = z.object({
  githubUserId: z.string(),
  login: z.string(),
  avatarUrl: z.string().nullable(),
  signatureCount: z.number()
});
export type KnownGitHubUser = z.infer<typeof KnownGitHubUserSchema>;

export const KnownUsersResponseSchema = z.object({
  users: z.array(KnownGitHubUserSchema)
});
export type KnownUsersResponse = z.infer<typeof KnownUsersResponseSchema>;

export const SelectTemplateRequestSchema = z.object({
  repositoryId: z.string().min(1),
  templateVersionId: z.string().min(1).nullable()
});
export type SelectTemplateRequest = z.infer<typeof SelectTemplateRequestSchema>;

export const SelectSigningModeRequestSchema = z.object({
  repositoryId: z.string().min(1),
  signingMode: RepositorySigningModeSchema
});
export type SelectSigningModeRequest = z.infer<typeof SelectSigningModeRequestSchema>;

export const SaveDropboxSignIntegrationRequestSchema = z.object({
  repositoryId: z.string().min(1),
  apiKey: z.string().trim().optional()
});
export type SaveDropboxSignIntegrationRequest = z.infer<typeof SaveDropboxSignIntegrationRequestSchema>;

export const ClaDocumentSourceSchema = z.enum(["repository", "default_template", "managed_template"]);
export type ClaDocumentSource = z.infer<typeof ClaDocumentSourceSchema>;

export const SigningContextSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  pull: z.string().nullable(),
  sha: z.string().nullable()
});
export type SigningContext = z.infer<typeof SigningContextSchema>;

export const SigningPageResponseSchema = z.object({
  user: AdminUserSchema,
  repository: z.object({
    owner: z.string(),
    name: z.string(),
    fullName: z.string()
  }),
  cla: z.object({
    documentId: z.string(),
    title: z.string(),
    body: z.string(),
    contentFormat: ClaContentFormatSchema,
    pdfUrl: z.string().nullable(),
    versionHash: z.string(),
    source: ClaDocumentSourceSchema,
    dropboxSignerRole: z.string().nullable().optional()
  }),
  signingMode: RepositorySigningModeSchema,
  dropboxSignConfigured: z.boolean(),
  context: SigningContextSchema
});
export type SigningPageResponse = z.infer<typeof SigningPageResponseSchema>;

export const SigningSubmitResponseSchema = z.object({
  ok: z.boolean(),
  message: z.string(),
  dropboxSignEmailSent: z.boolean().optional(),
  context: SigningContextSchema
});
export type SigningSubmitResponse = z.infer<typeof SigningSubmitResponseSchema>;

export const SignatureRecordSchema = z.object({
  kind: z.enum(["personal", "corporate"]),
  signerLogin: z.string(),
  githubUserId: z.string().nullable(),
  organizationLogin: z.string().nullable(),
  claVersionHash: z.string(),
  signedAt: z.string(),
  revokedAt: z.string().nullable(),
  documentSource: ClaDocumentSourceSchema,
  documentLabel: z.string()
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
