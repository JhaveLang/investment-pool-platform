-- Balance rules: payment methods with fees, the receipt date of deposits (drives the
-- 7-day accrual delay and the 60-day minimum term) and monthly return periods.
-- Existing deposits and withdrawals were booked without fees, so they are backfilled
-- as bank transfers with a fee of 0; reconciled deposits get their booking day as
-- receipt date. The new ledger entry types are only added here, never used, because
-- Postgres rejects using a new enum value in the transaction that adds it.
CREATE TYPE "public"."payment_method" AS ENUM('bank_transfer', 'crypto', 'exchange');--> statement-breakpoint
ALTER TYPE "public"."ledger_entry_type" ADD VALUE 'deposit_fee';--> statement-breakpoint
ALTER TYPE "public"."ledger_entry_type" ADD VALUE 'withdrawal_fee';--> statement-breakpoint
ALTER TYPE "public"."ledger_entry_type" ADD VALUE 'monthly_return';--> statement-breakpoint
CREATE TABLE "return_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period_start" date NOT NULL,
	"rate_ppm" integer NOT NULL,
	"total_cents" bigint NOT NULL,
	"account_count" integer NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "return_periods_period_start_unique" UNIQUE("period_start"),
	CONSTRAINT "return_periods_rate_range" CHECK ("return_periods"."rate_ppm" > -1000000 and "return_periods"."rate_ppm" <= 1000000),
	CONSTRAINT "return_periods_first_of_month" CHECK (extract(day from "return_periods"."period_start") = 1)
);
--> statement-breakpoint
ALTER TABLE "ledger_entries" DROP CONSTRAINT "ledger_entries_single_source";--> statement-breakpoint
ALTER TABLE "withdrawals" ALTER COLUMN "iban" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "deposits" ADD COLUMN "method" "payment_method" DEFAULT 'bank_transfer' NOT NULL;--> statement-breakpoint
ALTER TABLE "deposits" ALTER COLUMN "method" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "deposits" ADD COLUMN "fee_cents" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "deposits" ALTER COLUMN "fee_cents" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "deposits" ADD COLUMN "received_on" date;--> statement-breakpoint
UPDATE "deposits" SET "received_on" = ("created_at" AT TIME ZONE 'Europe/Berlin')::date WHERE "status" = 'reconciled';--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD COLUMN "return_period_id" uuid;--> statement-breakpoint
ALTER TABLE "withdrawals" ADD COLUMN "method" "payment_method" DEFAULT 'bank_transfer' NOT NULL;--> statement-breakpoint
ALTER TABLE "withdrawals" ALTER COLUMN "method" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "withdrawals" ADD COLUMN "fee_cents" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "withdrawals" ALTER COLUMN "fee_cents" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "withdrawals" ADD COLUMN "wallet_address" varchar(128);--> statement-breakpoint
ALTER TABLE "return_periods" ADD CONSTRAINT "return_periods_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_return_period_id_return_periods_id_fk" FOREIGN KEY ("return_period_id") REFERENCES "public"."return_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_entries_account_return_period_idx" ON "ledger_entries" USING btree ("account_id","return_period_id") WHERE "ledger_entries"."return_period_id" is not null;--> statement-breakpoint
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_fee_range" CHECK ("deposits"."fee_cents" >= 0 and "deposits"."fee_cents" < "deposits"."amount_cents");--> statement-breakpoint
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_received_when_reconciled" CHECK (("deposits"."status" = 'reconciled') = ("deposits"."received_on" is not null));--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_single_source" CHECK (num_nonnulls("ledger_entries"."deposit_id", "ledger_entries"."withdrawal_id", "ledger_entries"."return_period_id") = 1);--> statement-breakpoint
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_fee_non_negative" CHECK ("withdrawals"."fee_cents" >= 0);--> statement-breakpoint
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_single_destination" CHECK (num_nonnulls("withdrawals"."iban", "withdrawals"."wallet_address") = 1 and ("withdrawals"."method" = 'bank_transfer') = ("withdrawals"."iban" is not null));--> statement-breakpoint
CREATE TRIGGER return_periods_append_only
  BEFORE UPDATE OR DELETE ON return_periods
  FOR EACH ROW EXECUTE FUNCTION reject_append_only_mutation();
--> statement-breakpoint
CREATE TRIGGER return_periods_no_truncate
  BEFORE TRUNCATE ON return_periods
  FOR EACH STATEMENT EXECUTE FUNCTION reject_append_only_mutation();
