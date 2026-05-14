import cookie from "@fastify/cookie";
import formbody from "@fastify/formbody";
import fastify, { type FastifyInstance } from "fastify";
import { getConfig, type AppConfig } from "./config.js";
import { getDb, type DbClient } from "./db/client.js";
import { createGitHubApp, createOAuthApp, createWebhooks } from "./github/app.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerSignRoutes } from "./routes/sign.js";
import { registerWebhookRoutes } from "./routes/webhooks.js";

export type ServerDependencies = {
  config?: AppConfig;
  db?: DbClient;
  githubApp?: ReturnType<typeof createGitHubApp>;
  oauthApp?: ReturnType<typeof createOAuthApp>;
  webhooks?: ReturnType<typeof createWebhooks>;
};

export async function buildServer(dependencies: ServerDependencies = {}): Promise<FastifyInstance> {
  const config = dependencies.config ?? getConfig();
  const db = dependencies.db ?? getDb();
  const githubApp = dependencies.githubApp ?? createGitHubApp(config);
  const oauthApp = dependencies.oauthApp ?? createOAuthApp(config);
  const webhooks = dependencies.webhooks ?? createWebhooks(config);

  const app = fastify({
    logger: {
      level: config.NODE_ENV === "test" ? "silent" : "info"
    }
  });

  app.addContentTypeParser("application/json", { parseAs: "string" }, (_request, body, done) => {
    done(null, body);
  });

  await app.register(cookie, {
    secret: config.SESSION_SECRET
  });
  await app.register(formbody);

  app.get("/healthz", async () => ({ ok: true }));

  await registerWebhookRoutes(app, { db, githubApp, webhooks, config });
  await registerAuthRoutes(app, { db, oauthApp, config });
  await registerSignRoutes(app, { db, githubApp, config });

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const statusCode = message === "Authentication required" ? 401 : 500;
    reply.code(statusCode).send({
      error: statusCode === 401 ? "Authentication required" : "Internal server error"
    });
  });

  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const config = getConfig();
  const app = await buildServer({ config });

  await app.listen({
    port: config.PORT,
    host: "0.0.0.0"
  });
}
