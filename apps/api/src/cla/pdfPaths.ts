import type { AppConfig } from "../config.js";

export function adminTemplatePdfPath(templateId: string): string {
  return `/api/admin/templates/${templateId}/pdf`;
}

export function signClaPdfPath(
  documentId: string,
  context: {
    owner: string;
    repo: string;
    pull?: string | null;
    sha?: string | null;
  }
): string {
  const params = new URLSearchParams({
    owner: context.owner,
    repo: context.repo
  });
  if (context.pull) {
    params.set("pull", context.pull);
  }
  if (context.sha) {
    params.set("sha", context.sha);
  }

  return `/api/sign/cla/${documentId}/pdf?${params.toString()}`;
}

export function adminTemplatePdfUrl(config: AppConfig, templateId: string): string {
  return new URL(adminTemplatePdfPath(templateId), config.ADMIN_WEB_URL).toString();
}

export function signClaPdfUrl(
  config: AppConfig,
  documentId: string,
  context: {
    owner: string;
    repo: string;
    pull?: string | null;
    sha?: string | null;
  }
): string {
  return new URL(signClaPdfPath(documentId, context), config.ADMIN_WEB_URL).toString();
}
