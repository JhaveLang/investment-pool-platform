import "server-only";
import { and, eq, ne } from "drizzle-orm";
import { DomainError } from "@/lib/errors";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { getDb } from "@/server/db/client";
import { isUniqueViolation } from "@/server/db/errors";
import { sessions, users } from "@/server/db/schema";
import { recordAudit } from "./audit";

type ChangeOwnPasswordInput = {
  userId: string;
  currentPassword: string;
  newPassword: string;
  /** The caller's own session stays signed in; every other session of the user is ended. */
  keepSessionId: string | null;
  ipAddress: string | null;
};

export async function changeOwnPassword(input: ChangeOwnPasswordInput): Promise<void> {
  const db = getDb();
  const [user] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);
  if (!user) {
    throw new DomainError("NOT_FOUND");
  }

  const verified = await verifyPassword(input.currentPassword, user.passwordHash);
  const passwordHash = verified ? await hashPassword(input.newPassword) : null;

  // Compare-and-swap on the verified hash: if an admin reset the password in the meantime, nothing is overwritten.
  const changed =
    passwordHash === null
      ? false
      : await db.transaction(async (tx) => {
          const updated = await tx
            .update(users)
            .set({ passwordHash })
            .where(and(eq(users.id, input.userId), eq(users.passwordHash, user.passwordHash)))
            .returning({ id: users.id });
          if (updated.length === 0) {
            return false;
          }
          await tx
            .delete(sessions)
            .where(
              input.keepSessionId === null
                ? eq(sessions.userId, input.userId)
                : and(eq(sessions.userId, input.userId), ne(sessions.id, input.keepSessionId)),
            );
          await recordAudit(tx, {
            actorUserId: input.userId,
            action: "auth.password_changed",
            entityType: "user",
            entityId: input.userId,
            ipAddress: input.ipAddress,
          });
          return true;
        });

  if (!changed) {
    await recordAudit(db, {
      actorUserId: input.userId,
      action: "auth.password_change_failed",
      entityType: "user",
      entityId: input.userId,
      ipAddress: input.ipAddress,
    });
    throw new DomainError("WRONG_PASSWORD");
  }
}

type UpdateInvestorProfileInput = {
  adminId: string;
  userId: string;
  fullName: string;
  email: string;
  ipAddress: string | null;
};

/** Edits an investor's name and email. Returns `"unchanged"` (and writes nothing) when the values are identical. */
export async function updateInvestorProfile(input: UpdateInvestorProfileInput): Promise<"updated" | "unchanged"> {
  try {
    return await getDb().transaction(async (tx) => {
      const [investor] = await tx
        .select({ fullName: users.fullName, email: users.email, investorCode: users.investorCode })
        .from(users)
        .where(and(eq(users.id, input.userId), eq(users.role, "investor")))
        .for("update")
        .limit(1);
      if (!investor) {
        throw new DomainError("NOT_FOUND");
      }

      const changes: { fullName?: { from: string; to: string }; email?: { from: string; to: string } } = {};
      if (investor.fullName !== input.fullName) {
        changes.fullName = { from: investor.fullName, to: input.fullName };
      }
      if (investor.email !== input.email) {
        changes.email = { from: investor.email, to: input.email };
      }
      if (!changes.fullName && !changes.email) {
        return "unchanged";
      }

      await tx.update(users).set({ fullName: input.fullName, email: input.email }).where(eq(users.id, input.userId));
      await recordAudit(tx, {
        actorUserId: input.adminId,
        action: "user.updated",
        entityType: "user",
        entityId: input.userId,
        metadata: { investorName: input.fullName, investorCode: investor.investorCode, changes },
        ipAddress: input.ipAddress,
      });
      return "updated";
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new DomainError("EMAIL_TAKEN");
    }
    throw error;
  }
}

type SetInvestorPasswordInput = {
  adminId: string;
  userId: string;
  newPassword: string;
  ipAddress: string | null;
};

/** Admin password reset: sets the new password and signs the investor out everywhere. */
export async function setInvestorPassword(input: SetInvestorPasswordInput): Promise<void> {
  const passwordHash = await hashPassword(input.newPassword);
  await getDb().transaction(async (tx) => {
    const [investor] = await tx
      .select({ fullName: users.fullName, investorCode: users.investorCode })
      .from(users)
      .where(and(eq(users.id, input.userId), eq(users.role, "investor")))
      .for("update")
      .limit(1);
    if (!investor) {
      throw new DomainError("NOT_FOUND");
    }

    await tx.update(users).set({ passwordHash }).where(eq(users.id, input.userId));
    await tx.delete(sessions).where(eq(sessions.userId, input.userId));
    await recordAudit(tx, {
      actorUserId: input.adminId,
      action: "user.password_reset",
      entityType: "user",
      entityId: input.userId,
      metadata: { investorName: investor.fullName, investorCode: investor.investorCode },
      ipAddress: input.ipAddress,
    });
  });
}
