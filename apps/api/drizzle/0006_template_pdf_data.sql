ALTER TABLE "cla_template_versions" ADD COLUMN IF NOT EXISTS "pdf_data" bytea;--> statement-breakpoint
ALTER TABLE "cla_documents" ADD COLUMN IF NOT EXISTS "pdf_data" bytea;
