CREATE TABLE IF NOT EXISTS "user_signing_provider_credentials" (
  "credential_id" text PRIMARY KEY NOT NULL,
  "github_user_id" text NOT NULL REFERENCES "github_users"("github_user_id") ON DELETE CASCADE,
  "provider" "signature_provider" NOT NULL,
  "encrypted_api_key" text NOT NULL,
  "api_key_last4" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_signing_provider_credentials_user_provider_unique" ON "user_signing_provider_credentials" ("github_user_id", "provider");
