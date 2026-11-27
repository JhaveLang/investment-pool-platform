ALTER TYPE "ledger_entry_type" ADD VALUE 'promo_transfer';--> statement-breakpoint
ALTER TYPE "ledger_entry_type" ADD VALUE 'promo_principal_return';--> statement-breakpoint
CREATE TYPE "promo_booking_status" AS ENUM ('pending', 'booked', 'rejected', 'matured');
