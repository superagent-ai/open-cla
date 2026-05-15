import type { FastifyReply, FastifyRequest } from "fastify";
import { and, eq, or, gt, isNull } from "drizzle-orm";
import type { DbClient } from "../db/client.js";
import { githubUsers, userSessions, type GitHubUser } from "../db/schema.js";
import { createId } from "../utils/ids.js";

export const SESSION_COOKIE = "cla_session";

export type CurrentSession = {
  sessionId: string;
  accessToken: string;
  user: GitHubUser;
};

export async function createUserSession(params: {
  db: DbClient;
  reply: FastifyReply;
  githubUserId: string;
  login: string;
  avatarUrl?: string | null;
  accessToken: string;
  expiresAt?: Date | null;
}): Promise<void> {
  await params.db
    .insert(githubUsers)
    .values({
      githubUserId: params.githubUserId,
      login: params.login,
      avatarUrl: params.avatarUrl
    })
    .onConflictDoUpdate({
      target: githubUsers.githubUserId,
      set: {
        login: params.login,
        avatarUrl: params.avatarUrl,
        updatedAt: new Date()
      }
    });

  const sessionId = createId("sess");
  await params.db.insert(userSessions).values({
    sessionId,
    githubUserId: params.githubUserId,
    accessToken: params.accessToken,
    expiresAt: params.expiresAt
  });

  params.reply.setCookie(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    signed: true
  });
}

export async function getCurrentSession(
  db: DbClient,
  request: FastifyRequest
): Promise<CurrentSession | null> {
  const signedCookie = request.cookies[SESSION_COOKIE];
  if (!signedCookie) {
    return null;
  }

  const unsigned = request.unsignCookie(signedCookie);
  if (!unsigned.valid || !unsigned.value) {
    return null;
  }

  const session = await db.query.userSessions.findFirst({
    where: (table) =>
      and(
        eq(table.sessionId, unsigned.value),
        or(isNull(table.expiresAt), gt(table.expiresAt, new Date()))
      )
  });

  if (!session) {
    return null;
  }

  const user = await db.query.githubUsers.findFirst({
    where: (table) => eq(table.githubUserId, session.githubUserId)
  });

  if (!user) {
    return null;
  }

  return {
    sessionId: session.sessionId,
    accessToken: session.accessToken,
    user
  };
}

export function clearSession(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE, { path: "/" });
}
