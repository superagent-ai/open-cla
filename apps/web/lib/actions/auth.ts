"use server";

import { redirect } from "next/navigation";

import { serverApiMutate } from "./server-api";

export async function logoutAction(): Promise<void> {
  await serverApiMutate("POST", "/auth/logout");
  redirect("/");
}
