-- Approval-only booking: from now on a deposit is credited when the admin reconciles it and a withdrawal is
-- debited when the admin approves it. `credited_at` / `debited_at` record when the money was booked to the
-- ledger. Every deposit and withdrawal created before this migration was booked when it was submitted, so both
-- columns are backfilled with the submission time; those items are never booked a second time (rejecting one
-- still reverses or refunds it). The checks are added after the backfill, because they would reject the old rows.
ALTER TABLE "deposits" ADD COLUMN "credited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "withdrawals" ADD COLUMN "debited_at" timestamp with time zone;--> statement-breakpoint
UPDATE "deposits" SET "credited_at" = "created_at";--> statement-breakpoint
UPDATE "withdrawals" SET "debited_at" = "created_at";--> statement-breakpoint
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_credited_when_reconciled" CHECK ("deposits"."status" <> 'reconciled' or "deposits"."credited_at" is not null);--> statement-breakpoint
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_debited_when_approved" CHECK ("withdrawals"."status" <> 'approved' or "withdrawals"."debited_at" is not null);
