-- Free-form investor IDs: 6-20 upper-case letters, digits and hyphens (e.g. INV-0042) instead of
-- the fixed 01GR01 shape. Every existing ID matches the new rule, so nothing is rewritten. The
-- uniqueness and the "required for investors" checks stay as they are.
ALTER TABLE "users" DROP CONSTRAINT "users_investor_code_format";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "investor_code" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_investor_code_format" CHECK ("users"."investor_code" ~ '^[A-Z0-9-]{6,20}$');