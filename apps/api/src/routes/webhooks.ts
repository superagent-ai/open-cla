import type { App } from "@octokit/app";
import type {
  InstallationEvent,
  InstallationRepositoriesEvent,
  PullRequestEvent
} from "@octokit/webhooks-types";
import type { Webhooks } from "@octokit/webhooks";
import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../config.js";
import type { DbClient } from "../db/client.js";
import { getInstallationOctokit } from "../github/app.js";
import {
  handleInstallationRepositoriesWebhook,
  handleInstallationWebhook
} from "../webhooks/installation.js";
import { handlePullRequestWebhook } from "../webhooks/pullRequest.js";

export async function registerWebhookRoutes(
  app: FastifyInstance,
  params: {
    db: DbClient;
    githubApp: App;
    webhooks: Webhooks;
    config: AppConfig;
  }
): Promise<void> {
  app.post("/webhooks/github", async (request, reply) => {
    const rawBody = (request as typeof request & { rawBody?: string }).rawBody;
    const event = getHeader(request.headers["x-github-event"]);
    const delivery = getHeader(request.headers["x-github-delivery"]);
    const signature = getHeader(request.headers["x-hub-signature-256"]);

    if (!rawBody || !event || !delivery || !signature) {
      return reply.code(400).send({ error: "Missing GitHub webhook headers or body" });
    }

    const verified = await params.webhooks.verify(rawBody, signature);
    if (!verified) {
      return reply.code(401).send({ error: "Invalid GitHub webhook signature" });
    }

    const payload = (request.body ?? {}) as { installation?: { id?: number } };

    if (event === "ping") {
      return reply.send({ ok: true });
    }

    if (!payload.installation?.id) {
      return reply.code(400).send({ error: "Missing installation id" });
    }

    const octokit = await getInstallationOctokit(params.githubApp, payload.installation.id);

    if (event === "installation") {
      await handleInstallationWebhook({
        db: params.db,
        octokit,
        payload: payload as InstallationEvent
      });
      return reply.send({ ok: true });
    }

    if (event === "installation_repositories") {
      await handleInstallationRepositoriesWebhook({
        db: params.db,
        octokit,
        payload: payload as InstallationRepositoriesEvent
      });
      return reply.send({ ok: true });
    }

    if (event !== "pull_request") {
      return reply.send({ ok: true, ignored: event });
    }

    await handlePullRequestWebhook({
      db: params.db,
      octokit,
      config: params.config,
      payload: payload as PullRequestEvent
    });

    return reply.send({ ok: true });
  });
}

function getHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
