ALTER TABLE "investigations" ADD COLUMN "company_name" text;--> statement-breakpoint
ALTER TABLE "investigations" ADD COLUMN "sub_sector" text;--> statement-breakpoint
ALTER TABLE "investigations" ADD COLUMN "status_label" text;--> statement-breakpoint
ALTER TABLE "investigations" ADD COLUMN "confidence_reason" text;--> statement-breakpoint
ALTER TABLE "investigations" ADD COLUMN "evidence_summary_json" jsonb;--> statement-breakpoint
ALTER TABLE "investigations" ADD COLUMN "disclaimer" text;--> statement-breakpoint
ALTER TABLE "investigations" ADD COLUMN "what_to_monitor_json" jsonb;