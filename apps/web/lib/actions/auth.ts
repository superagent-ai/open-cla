"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { serverApiMutate } from "./server-api";

const SESSION_COOKIE = "cla_session";

/** Prefer a browser POST to `{apiBaseUrl}/auth/logout` so Set-Cookie reaches the client. */
export async function logoutAction(): Promise<void> {
  await serverApiMutate("POST", "/auth/logout");
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect("/");
}
