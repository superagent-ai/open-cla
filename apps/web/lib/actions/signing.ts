"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { githubLoginUrl, serverApiBaseUrl } from "@/lib/api";
import {
  dropboxEmailSentReturnPath,
  githubPullRequestUrl,
  signPagePath,
  signingContextParams,
  simpleSignReturnPath,
  type SigningKind
} from "@/lib/signing-return-url";

export async function signPersonalAction(formData: FormData): Promise<void> {
  await submitSigning("personal", formData);
}

export async function signCorporateAction(formData: FormData): Promise<void> {
  await submitSigning("corporate", formData);
}

async function submitSigning(kind: SigningKind, formData: FormData): Promise<void> {
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
    redirect(githubLoginUrl(returnPath));
  }

  if (upstream.ok) {
    const result = (await upstream.json()) as { dropboxSignEmailSent?: unknown };

    if (result.dropboxSignEmailSent === true) {
      redirect(dropboxEmailSentReturnPath(payload, kind));
    }

    const pullRequestUrl = githubPullRequestUrl(payload);
    if (pullRequestUrl) {
      redirect(pullRequestUrl);
    }

    redirect(simpleSignReturnPath(payload, kind));
  }

  const errorParams = signingContextParams(payload);
  errorParams.set("error", await readErrorMessage(upstream));
  redirect(`/sign?${errorParams.toString()}`);
}

function formPayload(formData: FormData, kind: SigningKind): Record<string, string> {
  const payload: Record<string, string> = {
    claDocumentId: stringValue(formData, "claDocumentId"),
    claVersionHash: stringValue(formData, "claVersionHash"),
    claTitle: stringValue(formData, "claTitle"),
    signerEmail: stringValue(formData, "signerEmail"),
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
  return signPagePath(payload);
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
