import "server-only";
import { eq } from "drizzle-orm";
import { DomainError } from "@/lib/errors";
import { generateInvestorCode } from "@/lib/investor-code";
import { getDummyPasswordHash, hashPassword, verifyPassword } from "@/server/auth/password";
import type { SessionUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { isUniqueViolation } from "@/server/db/errors";
import { accounts, users } from "@/server/db/schema";
import { recordAudit } from "./audit";

type RegisterInput = {
  fullName: string;
  email: string;
  password: string;
  ipAddress: string | null;
};

const MAX_CODE_ATTEMPTS = 5;
const INVESTOR_CODE_CONSTRAINT = "users_investor_code_unique";

/**
 * Creates the investor and their zero-balance account in one transaction. A fresh investor code is drawn per attempt;
 * a code collision aborts the transaction, so it is retried from the outside. `generateCode` is a test hook.
 */
export async function registerInvestor(
  input: RegisterInput,
  generateCode: () => string = generateInvestorCode,
): Promise<SessionUser> {
  const passwordHash = await hashPassword(input.password);

  for (let attempt = 1; ; attempt++) {
    try {
      return await getDb().transaction(async (tx) => {
        const [user] = await tx
          .insert(users)
          .values({
            fullName: input.fullName,
            email: input.email,
            passwordHash,
            role: "investor",
            investorCode: generateCode(),
          })
          .returning({ id: users.id, email: users.email, fullName: users.fullName, role: users.role });

        await tx.insert(accounts).values({ userId: user.id });

        await recordAudit(tx, {
          actorUserId: user.id,
          action: "auth.registered",
          entityType: "user",
          entityId: user.id,
          ipAddress: input.ipAddress,
        });

        return user;
      });
    } catch (error) {
      if (isUniqueViolation(error, INVESTOR_CODE_CONSTRAINT) && attempt < MAX_CODE_ATTEMPTS) {
        continue;
      }
      if (isUniqueViolation(error) && !isUniqueViolation(error, INVESTOR_CODE_CONSTRAINT)) {
        throw new DomainError("EMAIL_TAKEN");
      }
      throw error;
    }
  }
}

type AuthenticateInput = {
  email: string;
  password: string;
  ipAddress: string | null;
};

/** Verifies credentials and logs the attempt. Returns `null` for any failure. */
export async function authenticate(input: AuthenticateInput): Promise<SessionUser | null> {
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);

  // Always run a hash comparison so timing doesn't reveal whether the email exists.
  const passwordMatches = await verifyPassword(input.password, user?.passwordHash ?? (await getDummyPasswordHash()));

  if (!user || !passwordMatches) {
    await recordAudit(db, {
      actorUserId: user?.id ?? null,
      action: "auth.login_failed",
      metadata: { email: input.email },
      ipAddress: input.ipAddress,
    });
    return null;
  }

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  await recordAudit(db, {
    actorUserId: user.id,
    action: "auth.login",
    entityType: "user",
    entityId: user.id,
    ipAddress: input.ipAddress,
  });

  return { id: user.id, email: user.email, fullName: user.fullName, role: user.role };
}
