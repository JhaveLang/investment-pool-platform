CREATE TABLE "promo_bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL REFERENCES "accounts"("id"),
	"promo_offer_id" uuid NOT NULL REFERENCES "promo_offers"("id"),
	"promo_name" varchar(100) NOT NULL,
	"amount_cents" bigint NOT NULL,
	"term_months" integer NOT NULL,
	"total_return_bps" integer NOT NULL,
	"reference" varchar(32) NOT NULL UNIQUE,
	"idempotency_key" uuid NOT NULL,
	"status" "promo_booking_status" DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"maturity_on" date,
	"confirmation_sent_at" timestamp with time zone,
	"reviewed_by_user_id" uuid REFERENCES "users"("id"),
	"review_note" varchar(500),
	CONSTRAINT "promo_bookings_amount_whole_euros" CHECK ("amount_cents" > 0 and "amount_cents" % 100 = 0),
	CONSTRAINT "promo_bookings_term_months" CHECK ("term_months" between 1 and 120),
	CONSTRAINT "promo_bookings_return_range" CHECK ("total_return_bps" between 1 and 10000),
	CONSTRAINT "promo_bookings_processed_fields" CHECK (("status" in ('booked', 'matured')) = ("processed_at" is not null) and ("status" in ('booked', 'matured')) = ("maturity_on" is not null)),
	CONSTRAINT "promo_bookings_confirmation_after_request" CHECK ("confirmation_sent_at" is null or "confirmation_sent_at" >= "requested_at")
);--> statement-breakpoint
CREATE UNIQUE INDEX "promo_bookings_account_idempotency_idx" ON "promo_bookings" USING btree ("account_id", "idempotency_key");--> statement-breakpoint
CREATE INDEX "promo_bookings_status_requested_idx" ON "promo_bookings" USING btree ("status", "requested_at");--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD COLUMN "promo_booking_id" uuid REFERENCES "promo_bookings"("id");--> statement-breakpoint
ALTER TABLE "ledger_entries" DROP CONSTRAINT "ledger_entries_single_source";--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_single_source" CHECK (num_nonnulls("deposit_id", "withdrawal_id", "return_period_id", "promo_booking_id") = 1);--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_entries_promo_booking_type_idx" ON "ledger_entries" USING btree ("promo_booking_id", "entry_type") WHERE "promo_booking_id" is not null;
