CREATE TYPE "public"."cla_template_source" AS ENUM('default', 'uploaded');--> statement-breakpoint
CREATE TYPE "public"."repository_template_mode" AS ENUM('repository', 'managed');--> statement-breakpoint
ALTER TYPE "public"."cla_document_source" ADD VALUE 'managed_template';--> statement-breakpoint
CREATE TABLE "cla_template_versions" (
	"cla_template_version_id" text PRIMARY KEY NOT NULL,
	"cla_template_id" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"version_hash" text NOT NULL,
	"created_by_github_user_id" text,
	"created_by_login" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cla_templates" (
	"cla_template_id" text PRIMARY KEY NOT NULL,
	"repository_id" text,
	"source" "cla_template_source" NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_by_github_user_id" text,
	"created_by_login" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repository_template_settings" (
	"repository_id" text PRIMARY KEY NOT NULL,
	"mode" "repository_template_mode" DEFAULT 'repository' NOT NULL,
	"cla_template_version_id" text,
	"updated_by_github_user_id" text,
	"updated_by_login" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cla_template_versions" ADD CONSTRAINT "cla_template_versions_cla_template_id_cla_templates_cla_template_id_fk" FOREIGN KEY ("cla_template_id") REFERENCES "public"."cla_templates"("cla_template_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cla_template_versions" ADD CONSTRAINT "cla_template_versions_created_by_github_user_id_github_users_github_user_id_fk" FOREIGN KEY ("created_by_github_user_id") REFERENCES "public"."github_users"("github_user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cla_templates" ADD CONSTRAINT "cla_templates_repository_id_repositories_repository_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("repository_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cla_templates" ADD CONSTRAINT "cla_templates_created_by_github_user_id_github_users_github_user_id_fk" FOREIGN KEY ("created_by_github_user_id") REFERENCES "public"."github_users"("github_user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repository_template_settings" ADD CONSTRAINT "repository_template_settings_repository_id_repositories_repository_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("repository_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repository_template_settings" ADD CONSTRAINT "repository_template_settings_cla_template_version_id_cla_template_versions_cla_template_version_id_fk" FOREIGN KEY ("cla_template_version_id") REFERENCES "public"."cla_template_versions"("cla_template_version_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repository_template_settings" ADD CONSTRAINT "repository_template_settings_updated_by_github_user_id_github_users_github_user_id_fk" FOREIGN KEY ("updated_by_github_user_id") REFERENCES "public"."github_users"("github_user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cla_template_versions_template_hash_unique" ON "cla_template_versions" USING btree ("cla_template_id","version_hash");--> statement-breakpoint
CREATE INDEX "cla_template_versions_hash_idx" ON "cla_template_versions" USING btree ("version_hash");--> statement-breakpoint
CREATE INDEX "cla_templates_repository_idx" ON "cla_templates" USING btree ("repository_id");--> statement-breakpoint
CREATE INDEX "cla_templates_source_name_idx" ON "cla_templates" USING btree ("source","name");