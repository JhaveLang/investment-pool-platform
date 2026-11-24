import "server-only";
import { eq } from "drizzle-orm";
import { DomainError } from "@/lib/errors";
import { generateInvestorCode } from "@/lib/investor-code";
import { getDummyPasswordHash, hashPassword, verifyPassword } from "@/server/auth/password";
import type { SessionUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { INVESTOR_CODE_CONSTRAINT, isUniqueViolation } from "@/server/db/errors";
import { accounts, users } from "@/server/db/schema";
import { recordAudit } from "./audit";

type CreateInvestorInput = {
  fullName: string;
  email: string;
  password: string;
  /** Investor ID chosen by the admin; drawn at random when left out. */
  investorCode?: string;
  ipAddress: string | null;
  createdByAdminId: string;
};

const MAX_CODE_ATTEMPTS = 5;

/**
 * Creates the investor and their zero-balance account in one transaction; only admins create accounts.
 * Without a chosen investor code a fresh one is drawn per attempt; a collision aborts the transaction, so it is
 * retried from the outside. A chosen code that is taken fails with `INVESTOR_CODE_TAKEN`. `generateCode` is a test
 * hook.
 */
export async function createInvestor(
  input: CreateInvestorInput,
  generateCode: () => string = generateInvestorCode,
): Promise<SessionUser> {
  const passwordHash = await hashPassword(input.password);

  for (let attempt = 1; ; attempt++) {
    try {
      return await getDb().transaction(async (tx) => {
        const investorCode = input.investorCode ?? generateCode();
        const [user] = await tx
          .insert(users)
          .values({
            fullName: input.fullName,
            email: input.email,
            passwordHash,
            role: "investor",
            investorCode,
          })
          .returning({ id: users.id, email: users.email, fullName: users.fullName, role: users.role });

        await tx.insert(accounts).values({ userId: user.id });

        await recordAudit(tx, {
          actorUserId: input.createdByAdminId,
          action: "user.created",
          entityType: "user",
          entityId: user.id,
          metadata: { investorName: user.fullName, investorCode },
          ipAddress: input.ipAddress,
        });

        return user;
      });
    } catch (error) {
      if (isUniqueViolation(error, INVESTOR_CODE_CONSTRAINT)) {
        if (input.investorCode) {
          throw new DomainError("INVESTOR_CODE_TAKEN");
        }
        if (attempt < MAX_CODE_ATTEMPTS) {
          continue;
        }
      } else if (isUniqueViolation(error)) {
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

/**
 * Verifies credentials and logs the attempt. Returns `null` for wrong credentials. A deactivated investor who enters
 * the right password gets `ACCOUNT_DEACTIVATED`, so only the password holder learns the account's status.
 */
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

  if (user.deactivatedAt) {
    await recordAudit(db, {
      actorUserId: user.id,
      action: "auth.login_blocked",
      entityType: "user",
      entityId: user.id,
      ipAddress: input.ipAddress,
    });
    throw new DomainError("ACCOUNT_DEACTIVATED");
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
