/**
 * Creates the initial admin account from ADMIN_EMAIL / ADMIN_PASSWORD.
 * Idempotent: running it again leaves an existing admin untouched.
 *
 *   npm run db:seed
 */
import { eq } from "drizzle-orm";
import { hashPassword } from "@/server/auth/password";
import { closeDb, getDb } from "@/server/db/client";
import { users } from "@/server/db/schema";

const MIN_ADMIN_PASSWORD_LENGTH = 10;

async function seedAdmin(): Promise<void> {
  try {
    process.loadEnvFile();
  } catch {
    // No .env file: rely on the process environment (e.g. inside Docker).
  }

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const fullName = process.env.ADMIN_NAME?.trim() || "Administrator";

  if (!email || !password) {
    console.log("ADMIN_EMAIL / ADMIN_PASSWORD not set – skipping admin seed.");
    return;
  }
  if (password.length < MIN_ADMIN_PASSWORD_LENGTH) {
    throw new Error(`ADMIN_PASSWORD must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters long.`);
  }

  const db = getDb();
  const [existingUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existingUser) {
    console.log(`Admin ${email} already exists – nothing to do.`);
    return;
  }

  await db.insert(users).values({
    email,
    fullName,
    passwordHash: await hashPassword(password),
    role: "admin",
  });
  console.log(`Created admin user ${email}.`);
}

seedAdmin()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closeDb);
