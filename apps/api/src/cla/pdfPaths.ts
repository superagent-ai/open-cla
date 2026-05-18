import type { AppConfig } from "../config.js";

export function adminTemplatePdfPath(templateId: string): string {
  return `/api/admin/templates/${templateId}/pdf`;
}

export function signClaPdfPath(documentId: string): string {
  return `/api/sign/cla/${documentId}/pdf`;
}

export function adminTemplatePdfUrl(config: AppConfig, templateId: string): string {
  return new URL(adminTemplatePdfPath(templateId), config.ADMIN_WEB_URL).toString();
}

export function signClaPdfUrl(config: AppConfig, documentId: string): string {
  return new URL(signClaPdfPath(documentId), config.ADMIN_WEB_URL).toString();
}
