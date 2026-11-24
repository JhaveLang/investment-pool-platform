import "server-only";
import { and, eq, inArray, ne } from "drizzle-orm";
import { DomainError } from "@/lib/errors";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { getDb } from "@/server/db/client";
import { INVESTOR_CODE_CONSTRAINT, isUniqueViolation } from "@/server/db/errors";
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
  investorCode: string;
  ipAddress: string | null;
};

type FieldChange = { from: string | null; to: string };

/**
 * Edits an investor's name, email and investor ID. The ID is only a display code (records reference the user id),
 * so changing it leaves bookings and history intact. Returns `"unchanged"` (and writes nothing) when the values are
 * identical.
 */
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

      const changes: { fullName?: FieldChange; email?: FieldChange; investorCode?: FieldChange } = {};
      if (investor.fullName !== input.fullName) {
        changes.fullName = { from: investor.fullName, to: input.fullName };
      }
      if (investor.email !== input.email) {
        changes.email = { from: investor.email, to: input.email };
      }
      if (investor.investorCode !== input.investorCode) {
        changes.investorCode = { from: investor.investorCode, to: input.investorCode };
      }
      if (!changes.fullName && !changes.email && !changes.investorCode) {
        return "unchanged";
      }

      await tx
        .update(users)
        .set({ fullName: input.fullName, email: input.email, investorCode: input.investorCode })
        .where(eq(users.id, input.userId));
      await recordAudit(tx, {
        actorUserId: input.adminId,
        action: "user.updated",
        entityType: "user",
        entityId: input.userId,
        metadata: { investorName: input.fullName, investorCode: input.investorCode, changes },
        ipAddress: input.ipAddress,
      });
      return "updated";
    });
  } catch (error) {
    if (isUniqueViolation(error, INVESTOR_CODE_CONSTRAINT)) {
      throw new DomainError("INVESTOR_CODE_TAKEN");
    }
    if (isUniqueViolation(error)) {
      throw new DomainError("EMAIL_TAKEN");
    }
    throw error;
  }
}

export type InvestorCodeChange = { userId: string; investorCode: string };

type UpdateInvestorCodesInput = {
  adminId: string;
  changes: InvestorCodeChange[];
  ipAddress: string | null;
};

export type UpdateInvestorCodesResult =
  | { status: "saved"; count: number }
  /** Nothing was written: these investors' new IDs are held by someone else. */
  | { status: "taken"; userIds: string[] };

/**
 * Saves investor IDs edited in the investor list, all or nothing; unchanged ones are skipped. Every taken ID is
 * reported at once. An ID still held by another investor counts as taken even if that investor gets a new one in the
 * same batch (the unique check runs row by row), so swapping two IDs takes two saves.
 */
export async function updateInvestorCodes(input: UpdateInvestorCodesInput): Promise<UpdateInvestorCodesResult> {
  const userIds = input.changes.map((change) => change.userId);
  // The investor being updated, to name the one whose ID a concurrent save took.
  const progress: { userId?: string } = {};
  try {
    return await getDb().transaction(async (tx) => {
      const investors = await tx
        .select({ id: users.id, fullName: users.fullName, investorCode: users.investorCode })
        .from(users)
        .where(and(inArray(users.id, userIds), eq(users.role, "investor")))
        .for("update");
      if (investors.length !== new Set(userIds).size) {
        throw new DomainError("NOT_FOUND");
      }
      const investorById = new Map(investors.map((investor) => [investor.id, investor]));
      const changed = input.changes.filter(
        (change) => investorById.get(change.userId)?.investorCode !== change.investorCode,
      );
      if (changed.length === 0) {
        return { status: "saved", count: 0 };
      }

      const holders = await tx
        .select({ id: users.id, investorCode: users.investorCode })
        .from(users)
        .where(
          inArray(
            users.investorCode,
            changed.map((change) => change.investorCode),
          ),
        );
      const holderByCode = new Map(holders.map((holder) => [holder.investorCode, holder.id]));
      const taken = changed.filter((change) => {
        const holderId = holderByCode.get(change.investorCode);
        return holderId !== undefined && holderId !== change.userId;
      });
      if (taken.length > 0) {
        return { status: "taken", userIds: taken.map((change) => change.userId) };
      }

      for (const change of changed) {
        const investor = investorById.get(change.userId)!;
        progress.userId = change.userId;
        await tx.update(users).set({ investorCode: change.investorCode }).where(eq(users.id, change.userId));
        await recordAudit(tx, {
          actorUserId: input.adminId,
          action: "user.updated",
          entityType: "user",
          entityId: change.userId,
          metadata: {
            investorName: investor.fullName,
            investorCode: change.investorCode,
            changes: { investorCode: { from: investor.investorCode, to: change.investorCode } },
          },
          ipAddress: input.ipAddress,
        });
      }
      return { status: "saved", count: changed.length };
    });
  } catch (error) {
    // Taken by someone else between the check and the update.
    if (isUniqueViolation(error, INVESTOR_CODE_CONSTRAINT) && progress.userId) {
      return { status: "taken", userIds: [progress.userId] };
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

type SetInvestorStatusInput = {
  adminId: string;
  userId: string;
  /** `false` deactivates the investor, `true` activates them again. */
  active: boolean;
  note?: string;
  ipAddress: string | null;
};

/**
 * Deactivating blocks sign-in and signs the investor out everywhere; activating lets them sign in again with their
 * existing password. Balance, open requests and monthly returns are not affected either way.
 */
export async function setInvestorStatus(input: SetInvestorStatusInput): Promise<void> {
  await getDb().transaction(async (tx) => {
    const [investor] = await tx
      .select({ fullName: users.fullName, investorCode: users.investorCode, deactivatedAt: users.deactivatedAt })
      .from(users)
      .where(and(eq(users.id, input.userId), eq(users.role, "investor")))
      .for("update")
      .limit(1);
    if (!investor) {
      throw new DomainError("NOT_FOUND");
    }
    if ((investor.deactivatedAt === null) === input.active) {
      throw new DomainError("ALREADY_PROCESSED");
    }

    await tx
      .update(users)
      .set({ deactivatedAt: input.active ? null : new Date() })
      .where(eq(users.id, input.userId));
    if (!input.active) {
      await tx.delete(sessions).where(eq(sessions.userId, input.userId));
    }
    await recordAudit(tx, {
      actorUserId: input.adminId,
      action: input.active ? "user.activated" : "user.deactivated",
      entityType: "user",
      entityId: input.userId,
      metadata: { investorName: investor.fullName, investorCode: investor.investorCode, note: input.note },
      ipAddress: input.ipAddress,
    });
  });
}
