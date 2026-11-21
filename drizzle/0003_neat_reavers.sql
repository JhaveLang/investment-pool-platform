-- Investor IDs: every investor gets a permanent code like 01GR01 (two digits, two letters
-- without I and O, two digits). The column is added nullable first so existing rows
-- survive, the unique and format constraints go on next, then every existing investor
-- receives a random code (a unique_violation just draws a new one), and only afterwards
-- the "investor_code is required for investors" check is added, because it would reject
-- the old rows before the backfill. Admins keep a NULL code.
ALTER TABLE "users" ADD COLUMN "investor_code" varchar(6);--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_investor_code_unique" UNIQUE("investor_code");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_investor_code_format" CHECK ("users"."investor_code" ~ '^[0-9]{2}[A-HJ-NP-Z]{2}[0-9]{2}$');--> statement-breakpoint
DO $$
DECLARE
	letters constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ';
	investor record;
	candidate text;
BEGIN
	FOR investor IN SELECT id FROM "users" WHERE "role" = 'investor' AND "investor_code" IS NULL LOOP
		LOOP
			candidate := lpad(floor(random() * 100)::int::text, 2, '0')
				|| substr(letters, 1 + floor(random() * 24)::int, 1)
				|| substr(letters, 1 + floor(random() * 24)::int, 1)
				|| lpad(floor(random() * 100)::int::text, 2, '0');
			BEGIN
				UPDATE "users" SET "investor_code" = candidate WHERE id = investor.id;
				EXIT;
			EXCEPTION WHEN unique_violation THEN
				-- Code already taken: draw another one.
			END;
		END LOOP;
	END LOOP;
END $$;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_investor_code_required" CHECK ("users"."role" <> 'investor' OR "users"."investor_code" IS NOT NULL);
