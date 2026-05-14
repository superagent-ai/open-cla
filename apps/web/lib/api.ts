import { cookies } from "next/headers";

export const apiBaseUrl =
  process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

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
  const response = await fetch(`${apiBaseUrl}${path}`, {
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
  const url = new URL("/auth/github/start", apiBaseUrl);
  url.searchParams.set("returnTo", returnTo);
  return url.toString();
}
