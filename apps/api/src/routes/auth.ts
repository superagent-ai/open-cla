import { randomBytes } from "node:crypto";
import type { OAuthApp } from "@octokit/oauth-app";
import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../config.js";
import type { DbClient } from "../db/client.js";
import { createUserSession, clearSession } from "./session.js";

const OAUTH_STATE_COOKIE = "cla_oauth_state";
const OAUTH_RETURN_COOKIE = "cla_oauth_return";

type GitHubUserResponse = {
  id: number;
  login: string;
  avatar_url?: string | null;
};

export async function registerAuthRoutes(
  app: FastifyInstance,
  params: {
    db: DbClient;
    oauthApp: OAuthApp;
    config: AppConfig;
  }
): Promise<void> {
  app.get("/auth/github/start", async (request, reply) => {
    const query = request.query as { returnTo?: string };
    const state = randomBytes(24).toString("hex");
    const returnTo = sanitizeReturnTo(query.returnTo, params.config.ADMIN_WEB_URL);
    const redirectUrl = new URL("/auth/github/callback", params.config.PUBLIC_APP_URL).toString();
    const cookieDomain = params.config.COOKIE_DOMAIN;
    const { url } = params.oauthApp.getWebFlowAuthorizationUrl({
      state,
      redirectUrl,
      scopes: []
    });

    reply
      .setCookie(OAUTH_STATE_COOKIE, state, {
        httpOnly: true,
        path: "/",
        sameSite: "lax",
        secure: params.config.NODE_ENV === "production",
        signed: true,
        ...(cookieDomain ? { domain: cookieDomain } : {})
      })
      .setCookie(OAUTH_RETURN_COOKIE, returnTo, {
        httpOnly: true,
        path: "/",
        sameSite: "lax",
        secure: params.config.NODE_ENV === "production",
        signed: true,
        ...(cookieDomain ? { domain: cookieDomain } : {})
      })
      .redirect(url);
  });

  app.get("/auth/github/callback", async (request, reply) => {
    const query = request.query as { code?: string; state?: string };
    if (!query.code || !query.state) {
      return reply.code(400).send("Missing GitHub OAuth code or state");
    }

    const stateCookie = request.cookies[OAUTH_STATE_COOKIE];
    const unsignedState = stateCookie ? request.unsignCookie(stateCookie) : null;
    if (!unsignedState?.valid || unsignedState.value !== query.state) {
      return reply.code(400).send("Invalid GitHub OAuth state");
    }

    const { authentication } = await params.oauthApp.createToken({
      code: query.code,
      state: query.state
    });

    const token = authentication.token;
    const githubUser = await fetchGitHubUser(token);
    const maybeExpiresAt = (authentication as { expiresAt?: unknown }).expiresAt;
    const expiresAt = typeof maybeExpiresAt === "string" ? new Date(maybeExpiresAt) : null;

    await createUserSession({
      db: params.db,
      reply,
      githubUserId: String(githubUser.id),
      login: githubUser.login,
      avatarUrl: githubUser.avatar_url,
      accessToken: token,
      expiresAt,
      cookieDomain: params.config.COOKIE_DOMAIN
    });

    const returnCookie = request.cookies[OAUTH_RETURN_COOKIE];
    const unsignedReturn = returnCookie ? request.unsignCookie(returnCookie) : null;
    const returnTo =
      unsignedReturn?.valid && unsignedReturn.value ? unsignedReturn.value : "/";

    reply
      .clearCookie(OAUTH_STATE_COOKIE, {
        path: "/",
        ...(params.config.COOKIE_DOMAIN ? { domain: params.config.COOKIE_DOMAIN } : {})
      })
      .clearCookie(OAUTH_RETURN_COOKIE, {
        path: "/",
        ...(params.config.COOKIE_DOMAIN ? { domain: params.config.COOKIE_DOMAIN } : {})
      })
      .redirect(returnTo);
  });

  app.post("/auth/logout", async (_request, reply) => {
    clearSession(reply, params.config.COOKIE_DOMAIN);
    return reply.redirect("/");
  });
}

async function fetchGitHubUser(token: string): Promise<GitHubUserResponse> {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "user-agent": "superagent-cla"
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub user lookup failed with ${response.status}`);
  }

  return response.json() as Promise<GitHubUserResponse>;
}

function sanitizeReturnTo(returnTo: string | undefined, adminWebUrl: string): string {
  if (!returnTo || !returnTo.startsWith("/")) {
    return sanitizeAbsoluteReturnTo(returnTo, adminWebUrl);
  }

  return returnTo.startsWith("//") ? "/" : returnTo;
}

function sanitizeAbsoluteReturnTo(returnTo: string | undefined, adminWebUrl: string): string {
  if (!returnTo) {
    return "/";
  }

  try {
    const candidate = new URL(returnTo);
    const allowed = new URL(adminWebUrl);
    return candidate.origin === allowed.origin ? candidate.toString() : "/";
  } catch {
    return "/";
  }
}
