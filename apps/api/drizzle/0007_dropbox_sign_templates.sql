ALTER TYPE "public"."cla_template_source" ADD VALUE IF NOT EXISTS 'dropbox_sign';--> statement-breakpoint
ALTER TYPE "public"."cla_content_format" ADD VALUE IF NOT EXISTS 'dropbox_template';--> statement-breakpoint
ALTER TABLE "cla_template_versions" ADD COLUMN IF NOT EXISTS "dropbox_template_id" text;--> statement-breakpoint
ALTER TABLE "cla_template_versions" ADD COLUMN IF NOT EXISTS "dropbox_signer_role" text;--> statement-breakpoint
ALTER TABLE "cla_template_versions" ADD COLUMN IF NOT EXISTS "dropbox_template_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "cla_documents" ADD COLUMN IF NOT EXISTS "dropbox_template_id" text;--> statement-breakpoint
ALTER TABLE "cla_documents" ADD COLUMN IF NOT EXISTS "dropbox_signer_role" text;
