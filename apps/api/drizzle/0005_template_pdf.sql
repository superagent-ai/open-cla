CREATE TYPE "public"."cla_content_format" AS ENUM('markdown', 'pdf');--> statement-breakpoint
ALTER TABLE "cla_template_versions" ADD COLUMN "content_format" "cla_content_format" DEFAULT 'markdown' NOT NULL;--> statement-breakpoint
ALTER TABLE "cla_template_versions" ADD COLUMN "pdf_url" text;--> statement-breakpoint
ALTER TABLE "cla_template_versions" ADD COLUMN "pdf_file_name" text;--> statement-breakpoint
ALTER TABLE "cla_template_versions" ALTER COLUMN "body" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "cla_documents" ADD COLUMN "content_format" "cla_content_format" DEFAULT 'markdown' NOT NULL;--> statement-breakpoint
ALTER TABLE "cla_documents" ADD COLUMN "pdf_url" text;
