import { defineConfig } from "drizzle-kit";

// Load .env for local CLI usage; inside Docker the variables come from the container environment.
try {
  process.loadEnvFile();
} catch {
  // No .env file present.
}

export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  strict: true,
  verbose: true,
});
