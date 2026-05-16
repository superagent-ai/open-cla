import type { PullRequestEvent } from "@octokit/webhooks-types";
import { and, eq } from "drizzle-orm";
import type { AppConfig } from "../config.js";
import { getCoverageStatus, type Contributor } from "../cla/coverage.js";
import { resolveClaForRepository } from "../cla/resolveCla.js";
import type { DbClient } from "../db/client.js";
import {
  installations,
  orgMembershipCache,
  pullRequestChecks,
  repositories
} from "../db/schema.js";
import {
  CHECK_NAME,
  createOrUpdateCheckRun,
  type InstallationOctokit,
  upsertClaComment
} from "../github/app.js";

const SUPPORTED_ACTIONS = new Set([
  "opened",
  "reopened",
  "synchronize",
  "ready_for_review"
]);

export async function handlePullRequestWebhook(params: {
  db: DbClient;
  octokit: InstallationOctokit;
  config: AppConfig;
  payload: PullRequestEvent;
}): Promise<void> {
  const { payload } = params;
  if (!SUPPORTED_ACTIONS.has(payload.action) || payload.pull_request.draft) {
    return;
  }

  const installationId = payload.installation?.id;
  if (!installationId) {
    throw new Error("Pull request webhook is missing an installation id");
  }

  await upsertInstallationAndRepository(params.db, payload);

  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  const repositoryId = String(payload.repository.id);
  const headSha = payload.pull_request.head.sha;
  const pullNumber = payload.pull_request.number;

  const cla = await resolveClaForRepository({
    db: params.db,
    octokit: params.octokit,
    owner,
    repo,
    repositoryId,
    ref: payload.pull_request.base.ref,
    defaultTemplateName: params.config.DEFAULT_CLA_TEMPLATE_NAME
  });

  const contributors = await collectContributors({
    octokit: params.octokit,
    owner,
    repo,
    pullNumber,
    pullRequestUser: payload.pull_request.user
  });

  const coverage = await getCoverageStatus({
    db: params.db,
    contributors,
    claVersionHash: cla.versionHash,
    membershipVerifier: async ({ orgId, orgLogin, contributor }) =>
      verifyOrgMembership({
        db: params.db,
        octokit: params.octokit,
        orgId,
        orgLogin,
        contributor
      })
  });

  const detailsUrl = buildSigningUrl({
    webAppUrl: params.config.ADMIN_WEB_URL,
    owner,
    repo,
    pull: pullNumber,
    sha: headSha
  });

  const summary = coverage.covered
    ? "All PR contributors are covered by a CLA."
    : `${coverage.missingContributors.length} contributor(s) must sign the CLA.`;

  const text = coverage.covered
    ? `CLA version ${cla.versionHash} is satisfied for this pull request.`
    : [
        `CLA version ${cla.versionHash} is not yet satisfied.`,
        "",
        "Missing contributors:",
        ...coverage.missingContributors.map((contributor) => `- @${contributor.login}: ${contributor.reason}`)
      ].join("\n");

  const existingCheck = await params.db.query.pullRequestChecks.findFirst({
    where: (table) =>
      and(
        eq(table.repositoryId, repositoryId),
        eq(table.pullNumber, pullNumber),
        eq(table.headSha, headSha)
      )
  });

  const checkRunId = await createOrUpdateCheckRun({
    octokit: params.octokit,
    owner,
    repo,
    headSha,
    conclusion: coverage.covered ? "success" : "failure",
    title: coverage.covered ? "CLA satisfied" : "CLA signature required",
    summary,
    text,
    detailsUrl,
    checkRunId: existingCheck?.checkRunId
  });

  await params.db
    .insert(pullRequestChecks)
    .values({
      repositoryId,
      pullNumber,
      headSha,
      checkRunId,
      conclusion: coverage.covered ? "success" : "failure",
      detailsUrl,
      lastSummary: summary
    })
    .onConflictDoUpdate({
      target: [pullRequestChecks.repositoryId, pullRequestChecks.pullNumber, pullRequestChecks.headSha],
      set: {
        checkRunId,
        conclusion: coverage.covered ? "success" : "failure",
        detailsUrl,
        lastSummary: summary,
        updatedAt: new Date()
      }
    });

  await updatePullRequestComment({
    octokit: params.octokit,
    owner,
    repo,
    pullNumber,
    coverage,
    signingUrl: detailsUrl
  });
}

async function upsertInstallationAndRepository(
  db: DbClient,
  payload: PullRequestEvent
): Promise<void> {
  const installationId = payload.installation?.id;
  if (!installationId) {
    throw new Error("Cannot store repository without installation id");
  }

  const owner = payload.repository.owner;
  await db
    .insert(installations)
    .values({
      installationId: String(installationId),
      accountId: String(owner.id),
      accountLogin: owner.login,
      accountType: owner.type,
      permissions: null
    })
    .onConflictDoUpdate({
      target: installations.installationId,
      set: {
        accountId: String(owner.id),
        accountLogin: owner.login,
        accountType: owner.type,
        updatedAt: new Date()
      }
    });

  await db
    .insert(repositories)
    .values({
      repositoryId: String(payload.repository.id),
      installationId: String(installationId),
      owner: owner.login,
      name: payload.repository.name,
      fullName: payload.repository.full_name,
      defaultBranch: payload.repository.default_branch,
      private: payload.repository.private
    })
    .onConflictDoUpdate({
      target: repositories.repositoryId,
      set: {
        installationId: String(installationId),
        owner: owner.login,
        name: payload.repository.name,
        fullName: payload.repository.full_name,
        defaultBranch: payload.repository.default_branch,
        private: payload.repository.private,
        updatedAt: new Date()
      }
    });
}

async function collectContributors(params: {
  octokit: InstallationOctokit;
  owner: string;
  repo: string;
  pullNumber: number;
  pullRequestUser: PullRequestEvent["pull_request"]["user"];
}): Promise<Contributor[]> {
  const contributors: Contributor[] = [
    {
      githubUserId: params.pullRequestUser ? String(params.pullRequestUser.id) : null,
      login: params.pullRequestUser?.login ?? "unknown"
    }
  ];

  const commitsResponse = await params.octokit.request<
    Array<{ author: { id: number; login: string } | null }>
  >("GET /repos/{owner}/{repo}/pulls/{pull_number}/commits", {
    owner: params.owner,
    repo: params.repo,
    pull_number: params.pullNumber,
    per_page: 100
  });

  for (const commit of commitsResponse.data) {
    if (commit.author) {
      contributors.push({
        githubUserId: String(commit.author.id),
        login: commit.author.login
      });
    }
  }

  return contributors;
}

async function verifyOrgMembership(params: {
  db: DbClient;
  octokit: InstallationOctokit;
  orgId: string;
  orgLogin: string;
  contributor: Contributor;
}): Promise<boolean> {
  if (!params.contributor.githubUserId) {
    return false;
  }
  const githubUserId = params.contributor.githubUserId;

  try {
    await params.octokit.request("GET /orgs/{org}/members/{username}", {
      org: params.orgLogin,
      username: params.contributor.login
    });

    await cacheMembership(params, true);
    return true;
  } catch (error) {
    if (isNotFoundError(error)) {
      await cacheMembership(params, false);
      return false;
    }

    const cached = await params.db.query.orgMembershipCache.findFirst({
      where: (table) =>
        and(
          eq(table.orgId, params.orgId),
          eq(table.githubUserId, githubUserId),
          eq(table.active, true)
        )
    });

    return Boolean(cached);
  }
}

async function cacheMembership(
  params: {
    db: DbClient;
    orgId: string;
    orgLogin: string;
    contributor: Contributor;
  },
  active: boolean
): Promise<void> {
  if (!params.contributor.githubUserId) {
    return;
  }

  await params.db
    .insert(orgMembershipCache)
    .values({
      orgId: params.orgId,
      orgLogin: params.orgLogin,
      githubUserId: params.contributor.githubUserId,
      userLogin: params.contributor.login,
      active,
      source: "github_org_membership"
    })
    .onConflictDoUpdate({
      target: [orgMembershipCache.orgId, orgMembershipCache.githubUserId],
      set: {
        orgLogin: params.orgLogin,
        userLogin: params.contributor.login,
        active,
        source: "github_org_membership",
        lastCheckedAt: new Date(),
        updatedAt: new Date()
      }
    });
}

async function updatePullRequestComment(params: {
  octokit: InstallationOctokit;
  owner: string;
  repo: string;
  pullNumber: number;
  coverage: Awaited<ReturnType<typeof getCoverageStatus>>;
  signingUrl: string;
}): Promise<void> {
  const body = params.coverage.covered
    ? `## ${CHECK_NAME}\n\nAll contributors are covered by a CLA.`
    : [
        `## ${CHECK_NAME}`,
        "",
        "The following contributors need CLA coverage:",
        ...params.coverage.missingContributors.map((contributor) => `- @${contributor.login}`),
        "",
        `[Review and sign the CLA](${params.signingUrl})`
      ].join("\n");

  try {
    await upsertClaComment({
      octokit: params.octokit,
      owner: params.owner,
      repo: params.repo,
      issueNumber: params.pullNumber,
      body
    });
  } catch (error) {
    console.warn("Unable to update CLA pull request comment", error);
  }
}

function buildSigningUrl(params: {
  webAppUrl: string;
  owner: string;
  repo: string;
  pull: number;
  sha: string;
}): string {
  const url = new URL("/sign", params.webAppUrl);
  url.searchParams.set("owner", params.owner);
  url.searchParams.set("repo", params.repo);
  url.searchParams.set("pull", String(params.pull));
  url.searchParams.set("sha", params.sha);
  return url.toString();
}

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    Number((error as { status?: unknown }).status) === 404
  );
}
