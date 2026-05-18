export type SigningKind = "personal" | "corporate";

export function signingContextParams(payload: Record<string, string>): URLSearchParams {
  const params = new URLSearchParams();
  for (const name of ["owner", "repo", "pull", "sha"]) {
    if (payload[name]) {
      params.set(name, payload[name]);
    }
  }
  return params;
}

export function githubPullRequestUrl(payload: Record<string, string>): string | null {
  if (!payload.owner || !payload.repo || !payload.pull) {
    return null;
  }

  const owner = encodeURIComponent(payload.owner);
  const repo = encodeURIComponent(payload.repo);
  const pull = encodeURIComponent(payload.pull);
  return `https://github.com/${owner}/${repo}/pull/${pull}`;
}

export function signPagePath(payload: Record<string, string>): string {
  const params = signingContextParams(payload);
  const query = params.toString();
  return query ? `/sign?${query}` : "/sign";
}

/** After a simple (non-Dropbox) signature is recorded. */
export function simpleSignReturnPath(payload: Record<string, string>, kind: SigningKind): string {
  const params = signingContextParams(payload);
  params.set("signed", kind);
  return `/sign?${params.toString()}`;
}

/** After Dropbox Sign emails the signer a signing link. */
export function dropboxEmailSentReturnPath(payload: Record<string, string>, kind: SigningKind): string {
  const params = signingContextParams(payload);
  params.set("dropboxEmailSent", kind);
  return `/sign?${params.toString()}`;
}
