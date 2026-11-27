ALTER TABLE "promo_bookings" RENAME CONSTRAINT "promo_bookings_account_id_fkey" TO "promo_bookings_account_id_accounts_id_fk";--> statement-breakpoint
ALTER TABLE "promo_bookings" RENAME CONSTRAINT "promo_bookings_promo_offer_id_fkey" TO "promo_bookings_promo_offer_id_promo_offers_id_fk";--> statement-breakpoint
ALTER TABLE "promo_bookings" RENAME CONSTRAINT "promo_bookings_reviewed_by_user_id_fkey" TO "promo_bookings_reviewed_by_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "promo_bookings" RENAME CONSTRAINT "promo_bookings_reference_key" TO "promo_bookings_reference_unique";--> statement-breakpoint
ALTER TABLE "ledger_entries" RENAME CONSTRAINT "ledger_entries_promo_booking_id_fkey" TO "ledger_entries_promo_booking_id_promo_bookings_id_fk";
