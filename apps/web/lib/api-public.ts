const DEFAULT_API = "http://localhost:3000";

/**
 * Base URL for browser `fetch`. Safe to import from Client Components.
 * Prefer `NEXT_PUBLIC_API_BASE_URL` when the server-only `API_BASE_URL` is internal-only.
 */
export const browserApiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.API_BASE_URL ?? DEFAULT_API;

export const webBaseUrl = process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3001";

export function githubLoginUrl(returnPath = "/"): string {
  const returnTo = new URL(returnPath, webBaseUrl).toString();
  const url = new URL("/auth/github/start", browserApiBaseUrl);
  url.searchParams.set("returnTo", returnTo);
  return url.toString();
}
