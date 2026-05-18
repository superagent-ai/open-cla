"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { serverApiMutate } from "./server-api";

export async function deleteTemplateAction(templateId: string): Promise<void> {
  const response = await serverApiMutate("DELETE", `/api/admin/templates/${templateId}`);

  if (!response.ok) {
    throw new Error(response.error);
  }

  revalidatePath("/templates");
  redirect("/templates");
}
