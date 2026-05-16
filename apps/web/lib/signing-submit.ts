import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { githubLoginUrl, serverApiBaseUrl } from "@/lib/api";

type SigningKind = "personal" | "corporate";

export async function proxySigningSubmission(
  request: Request,
  kind: SigningKind
): Promise<Response> {
  const formData = await request.formData();
  const payload = formPayload(formData, kind);
  const returnPath = signingReturnPath(payload);
  const cookieStore = await cookies();

  const upstream = await fetch(`${serverApiBaseUrl}/api/sign/${kind}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieStore.toString()
    },
    body: JSON.stringify(payload),
    cache: "no-store"
  });

  if (upstream.status === 401) {
    return NextResponse.redirect(githubLoginUrl(returnPath));
  }

  const redirectParams = signingSearchParams(payload);
  if (upstream.ok) {
    redirectParams.set("signed", kind);
  } else {
    redirectParams.set("error", await readErrorMessage(upstream));
  }

  return NextResponse.redirect(new URL(`/sign?${redirectParams.toString()}`, request.url));
}

function formPayload(formData: FormData, kind: SigningKind): Record<string, string> {
  const payload: Record<string, string> = {
    claDocumentId: stringValue(formData, "claDocumentId"),
    claVersionHash: stringValue(formData, "claVersionHash"),
    owner: stringValue(formData, "owner"),
    repo: stringValue(formData, "repo"),
    pull: stringValue(formData, "pull"),
    sha: stringValue(formData, "sha")
  };

  if (kind === "corporate") {
    payload.orgLogin = stringValue(formData, "orgLogin");
  }

  return payload;
}

function signingReturnPath(payload: Record<string, string>): string {
  const params = signingSearchParams(payload);
  return `/sign${params.toString() ? `?${params.toString()}` : ""}`;
}

function signingSearchParams(payload: Record<string, string>): URLSearchParams {
  const params = new URLSearchParams();
  for (const name of ["owner", "repo", "pull", "sha"]) {
    if (payload[name]) {
      params.set(name, payload[name]);
    }
  }
  return params;
}

function stringValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown; message?: unknown };
    if (typeof body.error === "string") return body.error;
    if (typeof body.message === "string") return body.message;
  } catch {
    // Fall through to the generic message below.
  }

  return `Signing request failed with ${response.status}`;
}
