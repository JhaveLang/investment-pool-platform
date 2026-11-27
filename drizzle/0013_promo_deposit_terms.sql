ALTER TABLE "deposits" ADD COLUMN "promo_offer_id" uuid;--> statement-breakpoint
ALTER TABLE "deposits" ADD COLUMN "promo_name" varchar(100);--> statement-breakpoint
ALTER TABLE "deposits" ADD COLUMN "promo_term_months" integer;--> statement-breakpoint
ALTER TABLE "deposits" ADD COLUMN "promo_total_return_bps" integer;--> statement-breakpoint
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_promo_offer_id_promo_offers_id_fk" FOREIGN KEY ("promo_offer_id") REFERENCES "public"."promo_offers"("id");--> statement-breakpoint
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_promo_terms_snapshot" CHECK (("deposits"."promo_offer_id" is null and "deposits"."promo_name" is null and "deposits"."promo_term_months" is null and "deposits"."promo_total_return_bps" is null) or ("deposits"."promo_offer_id" is not null and "deposits"."promo_name" is not null and "deposits"."promo_term_months" is not null and "deposits"."promo_term_months" between 1 and 120 and "deposits"."promo_total_return_bps" is not null and "deposits"."promo_total_return_bps" between 1 and 10000));--> statement-breakpoint
CREATE INDEX "deposits_promo_offer_id_idx" ON "deposits" USING btree ("promo_offer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_entries_promo_return_deposit_idx" ON "ledger_entries" USING btree ("deposit_id") WHERE "ledger_entries"."entry_type" = 'promo_return';
