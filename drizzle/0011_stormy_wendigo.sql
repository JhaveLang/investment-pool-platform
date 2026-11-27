CREATE TABLE "promo_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"booking_until" date NOT NULL,
	"min_deposit_cents" bigint NOT NULL,
	"max_deposit_cents" bigint NOT NULL,
	"term_months" integer NOT NULL,
	"total_return_bps" integer NOT NULL,
	"visible" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promo_offers_name_length" CHECK (char_length("promo_offers"."name") between 1 and 100),
	CONSTRAINT "promo_offers_deposit_limits" CHECK ("promo_offers"."min_deposit_cents" > 0 and "promo_offers"."min_deposit_cents" <= "promo_offers"."max_deposit_cents"),
	CONSTRAINT "promo_offers_term_months" CHECK ("promo_offers"."term_months" between 1 and 120),
	CONSTRAINT "promo_offers_return_range" CHECK ("promo_offers"."total_return_bps" between 0 and 10000)
);
--> statement-breakpoint
CREATE INDEX "promo_offers_visible_booking_idx" ON "promo_offers" USING btree ("visible","booking_until");--> statement-breakpoint
INSERT INTO "promo_offers" ("name", "booking_until", "min_deposit_cents", "max_deposit_cents", "term_months", "total_return_bps", "visible")
VALUES ('Promo Return 5', '2026-06-26', 100000, 2500000, 5, 200, true);
