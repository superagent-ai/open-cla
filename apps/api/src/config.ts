import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv({ path: [".env", "../../.env"] });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  ADMIN_WEB_URL: z.string().url().default("http://localhost:3001"),
  DATABASE_URL: z.string().min(1),
  DATABASE_MIGRATION_URL: z.string().min(1).optional(),
  GITHUB_APP_ID: z.coerce.number().int().positive(),
  GITHUB_APP_PRIVATE_KEY: z.string().min(1),
  GITHUB_WEBHOOK_SECRET: z.string().min(1),
  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
  GITHUB_OAUTH_CLIENT_ID: z.string().min(1).optional(),
  GITHUB_OAUTH_CLIENT_SECRET: z.string().min(1).optional(),
  /** Comma-separated OAuth scopes for admin sign-in (default: read:org for org-owner repo listing). */
  GITHUB_OAUTH_SCOPES: z.string().default("read:org"),
  SESSION_SECRET: z.string().min(32),
  COOKIE_DOMAIN: z.string().min(1).optional(),
  DEFAULT_CLA_TEMPLATE_NAME: z.string().default("standard-combined-v1"),
  SIGNING_CREDENTIAL_ENCRYPTION_KEY: z.string().min(32).optional()
});

export type AppConfig = z.infer<typeof envSchema>;

let cachedConfig: AppConfig | undefined;

export function getConfig(): AppConfig {
  if (!cachedConfig) {
    cachedConfig = envSchema.parse(process.env);
  }

  return cachedConfig;
}

export function resetConfigForTests(): void {
  cachedConfig = undefined;
}

export function parseGithubOAuthScopes(scopes: string): string[] {
  return scopes
    .split(",")
    .map((scope) => scope.trim())
    .filter((scope) => scope.length > 0);
}
