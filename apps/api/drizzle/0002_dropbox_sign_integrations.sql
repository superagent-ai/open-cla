CREATE TYPE "public"."repository_signing_mode" AS ENUM('simple', 'dropbox_sign');--> statement-breakpoint
CREATE TYPE "public"."signature_provider" AS ENUM('dropbox_sign');--> statement-breakpoint
CREATE TYPE "public"."signature_request_kind" AS ENUM('personal', 'corporate');--> statement-breakpoint
CREATE TYPE "public"."signature_request_status" AS ENUM('pending', 'signed', 'completed', 'declined', 'expired', 'failed');--> statement-breakpoint
CREATE TABLE "repository_signing_settings" (
	"repository_id" text PRIMARY KEY NOT NULL,
	"signing_mode" "repository_signing_mode" DEFAULT 'simple' NOT NULL,
	"signing_provider_integration_id" text,
	"updated_by_github_user_id" text,
	"updated_by_login" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signature_requests" (
	"signature_request_id" text PRIMARY KEY NOT NULL,
	"kind" "signature_request_kind" NOT NULL,
	"provider" "signature_provider" NOT NULL,
	"status" "signature_request_status" DEFAULT 'pending' NOT NULL,
	"signing_provider_integration_id" text NOT NULL,
	"repository_id" text NOT NULL,
	"github_user_id" text NOT NULL,
	"signer_login" text NOT NULL,
	"signer_email" text NOT NULL,
	"org_id" text,
	"org_login" text,
	"cla_document_id" text NOT NULL,
	"cla_version_hash" text NOT NULL,
	"owner" text NOT NULL,
	"repo" text NOT NULL,
	"pull" text,
	"sha" text,
	"provider_request_id" text,
	"provider_signature_id" text,
	"provider_sign_url_expires_at" timestamp with time zone,
	"audit_trail_url" text,
	"signed_document_url" text,
	"completed_at" timestamp with time zone,
	"error_message" text,
	"provider_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signing_provider_integrations" (
	"signing_provider_integration_id" text PRIMARY KEY NOT NULL,
	"repository_id" text NOT NULL,
	"provider" "signature_provider" NOT NULL,
	"encrypted_api_key" text NOT NULL,
	"client_id" text NOT NULL,
	"test_mode" boolean DEFAULT false NOT NULL,
	"created_by_github_user_id" text,
	"created_by_login" text,
	"updated_by_github_user_id" text,
	"updated_by_login" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "repository_signing_settings" ADD CONSTRAINT "repository_signing_settings_repository_id_repositories_repository_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("repository_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repository_signing_settings" ADD CONSTRAINT "repository_signing_settings_signing_provider_integration_id_signing_provider_integrations_signing_provider_integration_id_fk" FOREIGN KEY ("signing_provider_integration_id") REFERENCES "public"."signing_provider_integrations"("signing_provider_integration_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repository_signing_settings" ADD CONSTRAINT "repository_signing_settings_updated_by_github_user_id_github_users_github_user_id_fk" FOREIGN KEY ("updated_by_github_user_id") REFERENCES "public"."github_users"("github_user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_requests" ADD CONSTRAINT "signature_requests_signing_provider_integration_id_signing_provider_integrations_signing_provider_integration_id_fk" FOREIGN KEY ("signing_provider_integration_id") REFERENCES "public"."signing_provider_integrations"("signing_provider_integration_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_requests" ADD CONSTRAINT "signature_requests_repository_id_repositories_repository_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("repository_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_requests" ADD CONSTRAINT "signature_requests_github_user_id_github_users_github_user_id_fk" FOREIGN KEY ("github_user_id") REFERENCES "public"."github_users"("github_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_requests" ADD CONSTRAINT "signature_requests_cla_document_id_cla_documents_cla_document_id_fk" FOREIGN KEY ("cla_document_id") REFERENCES "public"."cla_documents"("cla_document_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signing_provider_integrations" ADD CONSTRAINT "signing_provider_integrations_repository_id_repositories_repository_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("repository_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signing_provider_integrations" ADD CONSTRAINT "signing_provider_integrations_created_by_github_user_id_github_users_github_user_id_fk" FOREIGN KEY ("created_by_github_user_id") REFERENCES "public"."github_users"("github_user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signing_provider_integrations" ADD CONSTRAINT "signing_provider_integrations_updated_by_github_user_id_github_users_github_user_id_fk" FOREIGN KEY ("updated_by_github_user_id") REFERENCES "public"."github_users"("github_user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "signature_requests_provider_request_unique" ON "signature_requests" USING btree ("provider","provider_request_id");--> statement-breakpoint
CREATE INDEX "signature_requests_provider_signature_idx" ON "signature_requests" USING btree ("provider_signature_id");--> statement-breakpoint
CREATE INDEX "signature_requests_repository_status_idx" ON "signature_requests" USING btree ("repository_id","status");--> statement-breakpoint
CREATE INDEX "signature_requests_user_hash_idx" ON "signature_requests" USING btree ("github_user_id","cla_version_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "signing_provider_integrations_repo_provider_unique" ON "signing_provider_integrations" USING btree ("repository_id","provider");