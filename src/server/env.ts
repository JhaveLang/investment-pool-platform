import { z } from "zod";

/**
 * Environment access, validated lazily and per concern: the migration/seed tooling only
 * needs DATABASE_URL, the app additionally needs REDIS_URL. Nothing is read at import
 * time, so `next build` and the Docker image build work without runtime secrets.
 */
function readEnv<Schema extends z.ZodType>(schema: Schema): z.infer<Schema> {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

const databaseEnvSchema = z.object({ DATABASE_URL: z.string().min(1) });
const redisEnvSchema = z.object({ REDIS_URL: z.string().min(1) });
const cookieEnvSchema = z.object({
  // An empty value (e.g. `COOKIE_SECURE=` in docker-compose) counts as "not set".
  COOKIE_SECURE: z.preprocess((value) => (value === "" ? undefined : value), z.enum(["true", "false"]).optional()),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

const deeplEnvSchema = z.object({
  // Optional: without a key, news notices are saved untranslated. An empty value (e.g. from docker-compose) counts as
  // "not set".
  DEEPL_API_KEY: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().optional(),
  ),
});

export function getDatabaseUrl(): string {
  return readEnv(databaseEnvSchema).DATABASE_URL;
}

export function getRedisUrl(): string {
  return readEnv(redisEnvSchema).REDIS_URL;
}

/** The DeepL API key for translating news notices, or undefined when none is configured. */
export function getDeeplApiKey(): string | undefined {
  return readEnv(deeplEnvSchema).DEEPL_API_KEY;
}

export function isSecureCookieEnabled(): boolean {
  const { COOKIE_SECURE, NODE_ENV } = readEnv(cookieEnvSchema);
  return COOKIE_SECURE ? COOKIE_SECURE === "true" : NODE_ENV === "production";
}
