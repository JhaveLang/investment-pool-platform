-- Investor status: an admin can deactivate an investor (no sign-in, all sessions ended) and
-- activate them again. Nothing is deleted, so the ledger and the activity log stay complete.
-- NULL means active; existing investors stay active. Admin accounts can never be deactivated.
ALTER TABLE "users" ADD COLUMN "deactivated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_only_investors_deactivated" CHECK ("users"."role" = 'investor' OR "users"."deactivated_at" IS NULL);