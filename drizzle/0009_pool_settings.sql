-- Pool settings the admin edits: deposits open or closed, limits per request, and a notice for investors. The one
-- row starts with the limits in force so far (1,00 EUR to 10.000,00 EUR), so nothing changes until the admin saves.
CREATE TABLE "pool_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"deposits_open" boolean DEFAULT true NOT NULL,
	"deposit_min_cents" bigint NOT NULL,
	"deposit_max_cents" bigint NOT NULL,
	"withdrawal_min_cents" bigint NOT NULL,
	"withdrawal_max_cents" bigint NOT NULL,
	"notice_de" text,
	"notice_en" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pool_settings_single_row" CHECK ("pool_settings"."id" = 1),
	CONSTRAINT "pool_settings_deposit_limits" CHECK ("pool_settings"."deposit_min_cents" > 0 and "pool_settings"."deposit_min_cents" <= "pool_settings"."deposit_max_cents"),
	CONSTRAINT "pool_settings_withdrawal_limits" CHECK ("pool_settings"."withdrawal_min_cents" between 1 and 10000 and "pool_settings"."withdrawal_max_cents" >= 100000),
	CONSTRAINT "pool_settings_notice_de_length" CHECK ("pool_settings"."notice_de" IS NULL OR char_length("pool_settings"."notice_de") between 1 and 500),
	CONSTRAINT "pool_settings_notice_en_length" CHECK ("pool_settings"."notice_en" IS NULL OR char_length("pool_settings"."notice_en") between 1 and 500)
);
--> statement-breakpoint
INSERT INTO "pool_settings" ("deposit_min_cents", "deposit_max_cents", "withdrawal_min_cents", "withdrawal_max_cents") VALUES (100, 1000000, 100, 1000000);
