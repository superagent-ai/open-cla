import type {
  InstallationCreatedEvent,
  InstallationDeletedEvent,
  InstallationEvent,
  InstallationRepositoriesAddedEvent,
  InstallationRepositoriesEvent,
  InstallationRepositoriesRemovedEvent
} from "@octokit/webhooks-types";
import { eq, inArray } from "drizzle-orm";
import type { DbClient } from "../db/client.js";
import { installations, repositories } from "../db/schema.js";
import type { InstallationOctokit } from "../github/app.js";

type RepoListItem = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
};

export async function handleInstallationWebhook(params: {
  db: DbClient;
  octokit: InstallationOctokit;
  payload: InstallationEvent;
}): Promise<void> {
  const { db, octokit, payload } = params;

  if (payload.action === "deleted") {
    await db
      .delete(installations)
      .where(eq(installations.installationId, String(payload.installation.id)));
    return;
  }

  if (payload.action === "created") {
    await upsertInstallation(db, payload);
    await upsertRepositoriesFromGitHub({
      db,
      octokit,
      installationId: payload.installation.id,
      repositories: payload.repositories ?? []
    });
    return;
  }

  if (payload.action === "suspend") {
    return;
  }
}

export async function handleInstallationRepositoriesWebhook(params: {
  db: DbClient;
  octokit: InstallationOctokit;
  payload: InstallationRepositoriesEvent;
}): Promise<void> {
  const { db, octokit, payload } = params;
  await upsertInstallationFromRepositoriesEvent(db, payload);

  if (payload.action === "added") {
    await upsertRepositoriesFromGitHub({
      db,
      octokit,
      installationId: payload.installation.id,
      repositories: (payload as InstallationRepositoriesAddedEvent).repositories_added ?? []
    });
    return;
  }

  if (payload.action === "removed") {
    const removed = (payload as InstallationRepositoriesRemovedEvent).repositories_removed ?? [];
    if (removed.length === 0) {
      return;
    }

    const ids = removed.map((repository) => String(repository.id));
    await db.delete(repositories).where(inArray(repositories.repositoryId, ids));
  }
}

async function upsertInstallation(
  db: DbClient,
  payload: InstallationCreatedEvent | InstallationDeletedEvent
): Promise<void> {
  const installation = payload.installation;
  const account = installation.account;
  if (!account) {
    return;
  }

  await db
    .insert(installations)
    .values({
      installationId: String(installation.id),
      accountId: String(account.id),
      accountLogin: account.login,
      accountType: account.type,
      permissions: null
    })
    .onConflictDoUpdate({
      target: installations.installationId,
      set: {
        accountId: String(account.id),
        accountLogin: account.login,
        accountType: account.type,
        updatedAt: new Date()
      }
    });
}

async function upsertInstallationFromRepositoriesEvent(
  db: DbClient,
  payload: InstallationRepositoriesEvent
): Promise<void> {
  const installation = payload.installation;
  const account = installation.account;
  if (!account) {
    return;
  }

  await db
    .insert(installations)
    .values({
      installationId: String(installation.id),
      accountId: String(account.id),
      accountLogin: account.login,
      accountType: account.type,
      permissions: null
    })
    .onConflictDoUpdate({
      target: installations.installationId,
      set: {
        accountId: String(account.id),
        accountLogin: account.login,
        accountType: account.type,
        updatedAt: new Date()
      }
    });
}

async function upsertRepositoriesFromGitHub(params: {
  db: DbClient;
  octokit: InstallationOctokit;
  installationId: number | string;
  repositories: RepoListItem[];
}): Promise<void> {
  for (const repository of params.repositories) {
    const [owner, name] = repository.full_name.split("/");
    if (!owner || !name) {
      continue;
    }

    let defaultBranch = "main";
    try {
      const response = await params.octokit.request<{ default_branch: string }>(
        "GET /repos/{owner}/{repo}",
        { owner, repo: name }
      );
      defaultBranch = response.data.default_branch ?? defaultBranch;
    } catch {
      // If we cannot fetch full repo details, fall back to "main" so the row still exists.
    }

    await params.db
      .insert(repositories)
      .values({
        repositoryId: String(repository.id),
        installationId: String(params.installationId),
        owner,
        name,
        fullName: repository.full_name,
        defaultBranch,
        private: repository.private
      })
      .onConflictDoUpdate({
        target: repositories.repositoryId,
        set: {
          installationId: String(params.installationId),
          owner,
          name,
          fullName: repository.full_name,
          defaultBranch,
          private: repository.private,
          updatedAt: new Date()
        }
      });
  }
}
