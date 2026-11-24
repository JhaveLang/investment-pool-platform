CREATE INDEX "deposits_id_text_idx" ON "deposits" USING btree (("id"::text));--> statement-breakpoint
CREATE INDEX "ledger_entries_return_period_idx" ON "ledger_entries" USING btree ("return_period_id") WHERE "ledger_entries"."return_period_id" is not null;--> statement-breakpoint
CREATE INDEX "return_periods_id_text_idx" ON "return_periods" USING btree (("id"::text));--> statement-breakpoint
CREATE INDEX "withdrawals_id_text_idx" ON "withdrawals" USING btree (("id"::text));