import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import formbody from "@fastify/formbody";
import fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { getConfig, type AppConfig } from "./config.js";
import { getDb, type DbClient } from "./db/client.js";
import { createGitHubApp, createOAuthApp, createWebhooks } from "./github/app.js";
import { registerAdminRoutes } from "./routes/admin.js";
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

  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (request, body, done) => {
      const rawBody = typeof body === "string" ? body : body.toString("utf8");
      (request as typeof request & { rawBody?: string }).rawBody = rawBody;

      if (!rawBody) {
        done(null, undefined);
        return;
      }

      try {
        done(null, JSON.parse(rawBody));
      } catch (error) {
        done(error as Error, undefined);
      }
    }
  );

  await app.register(cookie, {
    secret: config.SESSION_SECRET
  });
  await app.register(cors, {
    credentials: true,
    origin: config.ADMIN_WEB_URL
  });
  await app.register(formbody);

  app.get("/healthz", async () => ({ ok: true }));

  await registerWebhookRoutes(app, { db, githubApp, webhooks, config });
  await registerAuthRoutes(app, { db, oauthApp, config });
  await registerAdminRoutes(app, { db, githubApp, config });
  await registerSignRoutes(app, { db, githubApp, config });

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    if (error instanceof ZodError) {
      reply.code(400).send({
        error: "Invalid request",
        issues: error.issues
      });
      return;
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    const statusCode =
      message === "Authentication required"
        ? 401
        : message.includes("not found")
          ? 404
          : message.includes("not available")
            ? 400
            : 500;
    reply.code(statusCode).send({
      error:
        statusCode === 401
          ? "Authentication required"
          : statusCode === 500
            ? "Internal server error"
            : message
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
