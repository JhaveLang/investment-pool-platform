-- First and last day for new deposits, both optional; with neither set, nothing changes.
ALTER TABLE "pool_settings" ADD COLUMN "deposits_from" date;--> statement-breakpoint
ALTER TABLE "pool_settings" ADD COLUMN "deposits_until" date;--> statement-breakpoint
ALTER TABLE "pool_settings" ADD CONSTRAINT "pool_settings_deposit_dates" CHECK ("pool_settings"."deposits_from" <= "pool_settings"."deposits_until");