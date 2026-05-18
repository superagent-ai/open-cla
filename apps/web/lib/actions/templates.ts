"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { serverApiMutate } from "./server-api";
import type { ActionResult } from "./types";

export async function createTemplateAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const title = stringField(formData, "title");
  const body = stringField(formData, "body");
  const description = stringField(formData, "description");

  if (!title) {
    return { error: "Title is required." };
  }
  if (!body) {
    return { error: "Template body cannot be empty." };
  }

  const response = await serverApiMutate("POST", "/api/admin/templates/global", {
    name: title,
    description,
    title,
    body
  });

  if (!response.ok) {
    return { error: response.error };
  }

  revalidatePath("/templates");
  redirect("/templates");
}

export async function updateTemplateAction(
  templateId: string,
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const title = stringField(formData, "title");
  const body = stringField(formData, "body");
  const description = stringField(formData, "description");

  if (!title) {
    return { error: "Title is required." };
  }
  if (!body) {
    return { error: "Template body cannot be empty." };
  }

  const response = await serverApiMutate("PUT", `/api/admin/templates/${templateId}`, {
    name: title,
    description,
    title,
    body
  });

  if (!response.ok) {
    return { error: response.error };
  }

  revalidatePath("/templates");
  revalidatePath(`/templates/${templateId}`);
  revalidatePath(`/templates/${templateId}/edit`);
  return { error: null };
}

export async function duplicateTemplateAction(templateId: string): Promise<void> {
  const response = await serverApiMutate("POST", `/api/admin/templates/${templateId}/duplicate`);

  if (!response.ok) {
    throw new Error(response.error);
  }

  const payload = response.body as { templateId?: string };
  if (!payload.templateId) {
    throw new Error("Duplicate template did not return an id");
  }

  revalidatePath("/templates");
  redirect(`/templates/${payload.templateId}/edit`);
}

export async function deleteTemplateAction(templateId: string): Promise<void> {
  const response = await serverApiMutate("DELETE", `/api/admin/templates/${templateId}`);

  if (!response.ok) {
    throw new Error(response.error);
  }

  revalidatePath("/templates");
  redirect("/templates");
}

function stringField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}
