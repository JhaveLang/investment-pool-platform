ALTER TABLE "promo_offers" ADD COLUMN "details" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "promo_offers" ADD COLUMN "is_example" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "promo_offers" ADD CONSTRAINT "promo_offers_details_length" CHECK (char_length("promo_offers"."details") <= 2000);--> statement-breakpoint
UPDATE "promo_offers"
SET "total_return_bps" = 3100,
    "details" = 'Minimum deposit: 1000 euros, Maximum deposit: 25,000 euros
Term: 5 months, total return at maturity: PLUS 31%
Example: Deposit of 1000 euros - The credit after 5 months amounts to 1310 euros.
Available for booking now. A minimum balance of €1000 must remain in the standard pool. Customers with a balance of €2000 or more can request a free transfer. Top-ups are also possible with a separate deposit. Transfers and new deposits always take 7 days to process. Package confirmation will be sent in writing within 10 days of application. This confirmation will include the deposit and withdrawal amounts and the exact date; please keep it safe. Transfers of odd amounts are possible, but not cent amounts.',
    "is_example" = true
WHERE "name" = 'Promo Return 5';
