CREATE TYPE "public"."check_conclusion" AS ENUM('success', 'failure', 'neutral', 'cancelled', 'skipped', 'timed_out', 'action_required');--> statement-breakpoint
CREATE TYPE "public"."cla_document_source" AS ENUM('repository', 'default_template');--> statement-breakpoint
CREATE TABLE "cla_documents" (
	"cla_document_id" text PRIMARY KEY NOT NULL,
	"repository_id" text,
	"source" "cla_document_source" NOT NULL,
	"template_name" text,
	"path" text,
	"git_sha" text,
	"version_hash" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "corporate_agreements" (
	"corporate_agreement_id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"org_login" text NOT NULL,
	"cla_document_id" text NOT NULL,
	"cla_version_hash" text NOT NULL,
	"authorized_signer_user_id" text NOT NULL,
	"authorized_signer_login" text NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_until" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "github_users" (
	"github_user_id" text PRIMARY KEY NOT NULL,
	"login" text NOT NULL,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "installations" (
	"installation_id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"account_login" text NOT NULL,
	"account_type" text NOT NULL,
	"permissions" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_membership_cache" (
	"org_id" text NOT NULL,
	"org_login" text NOT NULL,
	"github_user_id" text NOT NULL,
	"user_login" text NOT NULL,
	"active" boolean NOT NULL,
	"source" text NOT NULL,
	"last_checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "org_membership_cache_org_id_github_user_id_pk" PRIMARY KEY("org_id","github_user_id")
);
--> statement-breakpoint
CREATE TABLE "personal_signatures" (
	"signature_id" text PRIMARY KEY NOT NULL,
	"github_user_id" text NOT NULL,
	"cla_document_id" text NOT NULL,
	"cla_version_hash" text NOT NULL,
	"signer_login" text NOT NULL,
	"signer_ip" text,
	"user_agent" text,
	"signed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pull_request_checks" (
	"repository_id" text NOT NULL,
	"pull_number" integer NOT NULL,
	"head_sha" text NOT NULL,
	"check_run_id" text,
	"conclusion" "check_conclusion",
	"details_url" text,
	"last_summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pull_request_checks_repository_id_pull_number_head_sha_pk" PRIMARY KEY("repository_id","pull_number","head_sha")
);
--> statement-breakpoint
CREATE TABLE "repositories" (
	"repository_id" text PRIMARY KEY NOT NULL,
	"installation_id" text NOT NULL,
	"owner" text NOT NULL,
	"name" text NOT NULL,
	"full_name" text NOT NULL,
	"default_branch" text NOT NULL,
	"private" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"session_id" text PRIMARY KEY NOT NULL,
	"github_user_id" text NOT NULL,
	"access_token" text NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cla_documents" ADD CONSTRAINT "cla_documents_repository_id_repositories_repository_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("repository_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corporate_agreements" ADD CONSTRAINT "corporate_agreements_cla_document_id_cla_documents_cla_document_id_fk" FOREIGN KEY ("cla_document_id") REFERENCES "public"."cla_documents"("cla_document_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corporate_agreements" ADD CONSTRAINT "corporate_agreements_authorized_signer_user_id_github_users_github_user_id_fk" FOREIGN KEY ("authorized_signer_user_id") REFERENCES "public"."github_users"("github_user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_signatures" ADD CONSTRAINT "personal_signatures_github_user_id_github_users_github_user_id_fk" FOREIGN KEY ("github_user_id") REFERENCES "public"."github_users"("github_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_signatures" ADD CONSTRAINT "personal_signatures_cla_document_id_cla_documents_cla_document_id_fk" FOREIGN KEY ("cla_document_id") REFERENCES "public"."cla_documents"("cla_document_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pull_request_checks" ADD CONSTRAINT "pull_request_checks_repository_id_repositories_repository_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("repository_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_installation_id_installations_installation_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."installations"("installation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_github_user_id_github_users_github_user_id_fk" FOREIGN KEY ("github_user_id") REFERENCES "public"."github_users"("github_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cla_documents_hash_idx" ON "cla_documents" USING btree ("version_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "cla_documents_repo_hash_unique" ON "cla_documents" USING btree ("repository_id","version_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "corporate_agreements_org_hash_unique" ON "corporate_agreements" USING btree ("org_id","cla_version_hash");--> statement-breakpoint
CREATE INDEX "corporate_agreements_hash_idx" ON "corporate_agreements" USING btree ("cla_version_hash");--> statement-breakpoint
CREATE INDEX "org_membership_cache_user_idx" ON "org_membership_cache" USING btree ("github_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "personal_signatures_user_hash_unique" ON "personal_signatures" USING btree ("github_user_id","cla_version_hash");--> statement-breakpoint
CREATE INDEX "personal_signatures_hash_idx" ON "personal_signatures" USING btree ("cla_version_hash");--> statement-breakpoint
CREATE INDEX "pull_request_checks_repo_pr_idx" ON "pull_request_checks" USING btree ("repository_id","pull_number");--> statement-breakpoint
CREATE UNIQUE INDEX "repositories_owner_name_unique" ON "repositories" USING btree ("owner","name");--> statement-breakpoint
CREATE INDEX "repositories_installation_idx" ON "repositories" USING btree ("installation_id");--> statement-breakpoint
CREATE INDEX "user_sessions_user_idx" ON "user_sessions" USING btree ("github_user_id");