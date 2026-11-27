CREATE TYPE "public"."ledger_entry_type_new" AS ENUM ('deposit', 'withdrawal', 'deposit_reversal', 'withdrawal_reversal', 'deposit_fee', 'withdrawal_fee', 'monthly_return', 'promo_return');--> statement-breakpoint
ALTER TABLE "ledger_entries" ALTER COLUMN "entry_type" TYPE "public"."ledger_entry_type_new" USING "entry_type"::text::"public"."ledger_entry_type_new";--> statement-breakpoint
ALTER TYPE "public"."ledger_entry_type" RENAME TO "ledger_entry_type_old";--> statement-breakpoint
ALTER TYPE "public"."ledger_entry_type_new" RENAME TO "ledger_entry_type";--> statement-breakpoint
DROP TYPE "public"."ledger_entry_type_old";
