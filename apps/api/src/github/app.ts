import { App } from "@octokit/app";
import { OAuthApp } from "@octokit/oauth-app";
import { Webhooks } from "@octokit/webhooks";
import type { AppConfig } from "../config.js";

export const CHECK_NAME = "Contributor License Agreement";

export type InstallationOctokit = {
  request: <TData = any>(
    route: string,
    options?: Record<string, unknown>
  ) => Promise<{ data: TData }>;
};

export function normalizePrivateKey(privateKey: string): string {
  return privateKey.replace(/\\n/g, "\n");
}

export function createGitHubApp(config: AppConfig): App {
  return new App({
    appId: config.GITHUB_APP_ID,
    privateKey: normalizePrivateKey(config.GITHUB_APP_PRIVATE_KEY)
  });
}

export function createOAuthApp(config: AppConfig): OAuthApp {
  return new OAuthApp({
    clientId: config.GITHUB_OAUTH_CLIENT_ID ?? config.GITHUB_CLIENT_ID,
    clientSecret: config.GITHUB_OAUTH_CLIENT_SECRET ?? config.GITHUB_CLIENT_SECRET,
    defaultScopes: []
  });
}

export function createWebhooks(config: AppConfig): Webhooks {
  return new Webhooks({
    secret: config.GITHUB_WEBHOOK_SECRET
  });
}

export async function getInstallationOctokit(
  app: App,
  installationId: string | number
): Promise<InstallationOctokit> {
  return (await app.getInstallationOctokit(Number(installationId))) as unknown as InstallationOctokit;
}

export async function createOrUpdateCheckRun(params: {
  octokit: InstallationOctokit;
  owner: string;
  repo: string;
  headSha: string;
  conclusion: "success" | "failure" | "neutral" | "action_required";
  title: string;
  summary: string;
  text?: string;
  detailsUrl?: string;
  checkRunId?: string | null;
}): Promise<string> {
  const output = {
    title: params.title,
    summary: params.summary,
    text: params.text
  };

  if (params.checkRunId) {
    try {
      const response = await params.octokit.request<{ id: number }>(
        "PATCH /repos/{owner}/{repo}/check-runs/{check_run_id}",
        {
        owner: params.owner,
        repo: params.repo,
        check_run_id: Number(params.checkRunId),
        status: "completed",
        conclusion: params.conclusion,
        details_url: params.detailsUrl,
        output
        }
      );
      return String(response.data.id);
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }
    }
  }

  const response = await params.octokit.request<{ id: number }>(
    "POST /repos/{owner}/{repo}/check-runs",
    {
      owner: params.owner,
      repo: params.repo,
      name: CHECK_NAME,
      head_sha: params.headSha,
      status: "completed",
      conclusion: params.conclusion,
      details_url: params.detailsUrl,
      output
    }
  );

  return String(response.data.id);
}

export async function upsertClaComment(params: {
  octokit: InstallationOctokit;
  owner: string;
  repo: string;
  issueNumber: number;
  body: string;
}): Promise<void> {
  const marker = "<!-- superagent-cla-status -->";
  const body = `${marker}\n${params.body}`;
  const comments = await params.octokit.request<Array<{ id: number; body?: string | null }>>(
    "GET /repos/{owner}/{repo}/issues/{issue_number}/comments",
    {
      owner: params.owner,
      repo: params.repo,
      issue_number: params.issueNumber,
      per_page: 100
    }
  );

  const existing = comments.data.find((comment: { body?: string | null }) =>
    comment.body?.startsWith(marker)
  );
  if (existing) {
    await params.octokit.request("PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}", {
      owner: params.owner,
      repo: params.repo,
      comment_id: existing.id,
      body
    });
    return;
  }

  await params.octokit.request("POST /repos/{owner}/{repo}/issues/{issue_number}/comments", {
    owner: params.owner,
    repo: params.repo,
    issue_number: params.issueNumber,
    body
  });
}

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    Number((error as { status?: unknown }).status) === 404
  );
}
