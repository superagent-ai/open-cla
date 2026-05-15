import { cookies } from "next/headers";

const DEFAULT_API = "http://localhost:3000";

/**
 * Base URL for server-side `adminApiFetch` (RSC / Route Handlers). Prefer `API_BASE_URL` so
 * Docker/Kubernetes can use an internal hostname (e.g. `http://api:3000`).
 */
export const serverApiBaseUrl =
  process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API;

/**
 * Base URL for browser `fetch` (template selection, Cmd+K search, logout). Must be a host the
 * user's machine can resolve; use `NEXT_PUBLIC_API_BASE_URL` when `API_BASE_URL` is internal-only.
 */
export const browserApiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.API_BASE_URL ?? DEFAULT_API;

export const webBaseUrl = process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3001";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

export async function adminApiFetch<T>(path: string): Promise<T> {
  const cookieStore = await cookies();
  const response = await fetch(`${serverApiBaseUrl}${path}`, {
    headers: {
      cookie: cookieStore.toString()
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new ApiError(`API request failed with ${response.status}`, response.status);
  }

  return response.json() as Promise<T>;
}

export function githubLoginUrl(returnPath = "/"): string {
  const returnTo = new URL(returnPath, webBaseUrl).toString();
  const url = new URL("/auth/github/start", browserApiBaseUrl);
  url.searchParams.set("returnTo", returnTo);
  return url.toString();
}
