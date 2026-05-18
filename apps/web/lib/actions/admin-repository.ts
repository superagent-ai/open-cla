"use server";

import type {
  RepositorySigningMode,
  RepositorySigningSettings,
  RepositoryTemplateSettings,
  TemplatesResponse
} from "@superagent-cla/shared";

import { serverApiMutate } from "./server-api";
import type { RepositoryActionResult } from "./types";

export async function updateTemplateSelectionAction(
  repositoryId: string,
  templateVersionId: string | null
): Promise<RepositoryActionResult> {
  const response = await serverApiMutate(
    "PUT",
    `/api/admin/repositories/${repositoryId}/template-selection`,
    { repositoryId, templateVersionId }
  );

  if (!response.ok) {
    return { error: response.error };
  }

  const settings = readSettings(response.body);
  if (!settings) {
    return { error: "Template settings were not returned by the API" };
  }

  return { error: null, patch: { settings } };
}

export async function updateSigningModeAction(
  repositoryId: string,
  signingMode: RepositorySigningMode
): Promise<RepositoryActionResult> {
  const response = await serverApiMutate(
    "PUT",
    `/api/admin/repositories/${repositoryId}/signing-settings`,
    { repositoryId, signingMode }
  );

  if (!response.ok) {
    return { error: response.error };
  }

  const signingSettings = readSigningSettings(response.body);
  if (!signingSettings) {
    return { error: "Signing settings were not returned by the API" };
  }

  return { error: null, patch: { signingSettings } };
}

export async function saveDropboxSignIntegrationAction(
  repositoryId: string,
  _prevState: RepositoryActionResult,
  formData: FormData
): Promise<RepositoryActionResult> {
  const apiKey = stringField(formData, "apiKey");

  const response = await serverApiMutate(
    "PUT",
    `/api/admin/repositories/${repositoryId}/dropbox-sign-integration`,
    {
      repositoryId,
      ...(apiKey ? { apiKey } : {})
    }
  );

  if (!response.ok) {
    return { error: response.error };
  }

  const signingSettings = readSigningSettings(response.body);
  if (!signingSettings) {
    return { error: "Signing settings were not returned by the API" };
  }

  return { error: null, patch: { signingSettings } };
}

function readSettings(body: unknown): RepositoryTemplateSettings | null {
  if (!body || typeof body !== "object") {
    return null;
  }
  const settings = (body as { settings?: unknown }).settings;
  return settings && typeof settings === "object" ? (settings as RepositoryTemplateSettings) : null;
}

function readSigningSettings(body: unknown): RepositorySigningSettings | null {
  if (!body || typeof body !== "object") {
    return null;
  }
  const signingSettings = (body as { signingSettings?: unknown }).signingSettings;
  return signingSettings && typeof signingSettings === "object"
    ? (signingSettings as RepositorySigningSettings)
    : null;
}

function stringField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}
