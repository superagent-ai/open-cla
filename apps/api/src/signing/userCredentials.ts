import { eq, and } from "drizzle-orm";
import type { AppConfig } from "../config.js";
import type { DbClient } from "../db/client.js";
import { userSigningProviderCredentials } from "../db/schema.js";
import { createId } from "../utils/ids.js";
import { decryptSigningCredential, encryptSigningCredential } from "./credentials.js";

export async function getUserDropboxSignCredentialLast4(
  db: DbClient,
  githubUserId: string
): Promise<string | null> {
  const row = await db.query.userSigningProviderCredentials.findFirst({
    where: (table) =>
      and(eq(table.githubUserId, githubUserId), eq(table.provider, "dropbox_sign"))
  });
  return row?.apiKeyLast4 ?? null;
}

export async function resolveDropboxApiKey(
  db: DbClient,
  config: AppConfig,
  githubUserId: string,
  providedKey?: string
): Promise<string | null> {
  if (providedKey) {
    return providedKey;
  }

  return getDecryptedUserDropboxApiKey(db, config, githubUserId);
}

export async function saveUserDropboxSignCredential(
  db: DbClient,
  config: AppConfig,
  githubUserId: string,
  apiKey: string
): Promise<void> {
  const credentialId = createId("usigncred");
  await db
    .insert(userSigningProviderCredentials)
    .values({
      credentialId,
      githubUserId,
      provider: "dropbox_sign",
      encryptedApiKey: encryptSigningCredential(config, apiKey),
      apiKeyLast4: keySuffix(apiKey)
    })
    .onConflictDoUpdate({
      target: [
        userSigningProviderCredentials.githubUserId,
        userSigningProviderCredentials.provider
      ],
      set: {
        encryptedApiKey: encryptSigningCredential(config, apiKey),
        apiKeyLast4: keySuffix(apiKey),
        updatedAt: new Date()
      }
    });
}

async function getDecryptedUserDropboxApiKey(
  db: DbClient,
  config: AppConfig,
  githubUserId: string
): Promise<string | null> {
  const row = await db.query.userSigningProviderCredentials.findFirst({
    where: (table) =>
      and(eq(table.githubUserId, githubUserId), eq(table.provider, "dropbox_sign"))
  });
  if (!row) {
    return null;
  }

  return decryptSigningCredential(config, row.encryptedApiKey);
}

function keySuffix(value: string): string {
  return value.slice(-4);
}
