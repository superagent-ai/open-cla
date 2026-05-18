import { cookies } from "next/headers";

import { serverApiBaseUrl } from "@/lib/api";

type MutationResult =
  | { ok: true; status: number; body: unknown }
  | { ok: false; status: number; error: string };

export async function serverApiMutate(
  method: string,
  path: string,
  body?: unknown
): Promise<MutationResult> {
  const cookieStore = await cookies();
  const response = await fetch(`${serverApiBaseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      cookie: cookieStore.toString()
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store"
  });

  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = text;
    }
  }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: readApiError(parsed, response.status)
    };
  }

  return { ok: true, status: response.status, body: parsed };
}

function readApiError(body: unknown, status: number): string {
  if (body && typeof body === "object") {
    const record = body as {
      error?: unknown;
      message?: unknown;
      issues?: Array<{ path?: Array<string | number>; message?: string }>;
    };
    const detail = record.issues?.length
      ? record.issues
          .map((issue) => `${issue.path?.join(".") ?? "field"}: ${issue.message ?? "invalid"}`)
          .join("; ")
      : null;
    if (typeof record.error === "string") {
      return detail ? `${record.error} – ${detail}` : record.error;
    }
    if (typeof record.message === "string") {
      return record.message;
    }
  }

  return `Request failed with ${status}`;
}
