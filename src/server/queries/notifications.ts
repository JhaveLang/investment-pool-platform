import "server-only";
import { and, desc, eq, gt, inArray, max, sql, type SQL } from "drizzle-orm";
import {
  ADMIN_NOTIFICATION_TYPES,
  isAdminNotificationType,
  isInvestorNotificationType,
  type AdminNotification,
  type InvestorNotification,
} from "@/lib/notifications";
import { getDb } from "@/server/db/client";
import { accounts, auditLogs, deposits, ledgerEntries, returnPeriods, users, withdrawals } from "@/server/db/schema";

async function selectAdminNotifications(filter: SQL | undefined, limit: number): Promise<AdminNotification[]> {
  const rows = await getDb()
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      createdAt: auditLogs.createdAt,
      metadata: auditLogs.metadata,
      investorId: auditLogs.actorUserId,
      investorName: users.fullName,
      investorCode: users.investorCode,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorUserId, users.id))
    .where(and(inArray(auditLogs.action, [...ADMIN_NOTIFICATION_TYPES]), filter))
    .orderBy(desc(auditLogs.id))
    .limit(limit);

  return rows.flatMap((row) =>
    isAdminNotificationType(row.action)
      ? [
          {
            id: row.id,
            type: row.action,
            createdAt: row.createdAt.toISOString(),
            investorId: row.investorId,
            investorName: row.investorName,
            investorCode: row.investorCode,
            amountCents: typeof row.metadata.amountCents === "number" ? row.metadata.amountCents : null,
            reference: typeof row.metadata.reference === "string" ? row.metadata.reference : null,
          },
        ]
      : [],
  );
}

/**
 * The newest admin notifications, read from the activity log (newest first). With `afterId`, only entries logged
 * after that one, e.g. to replay what a reconnecting browser missed.
 */
export async function listAdminNotifications(options: {
  limit: number;
  afterId?: number;
}): Promise<AdminNotification[]> {
  return selectAdminNotifications(
    options.afterId === undefined ? undefined : gt(auditLogs.id, options.afterId),
    options.limit,
  );
}

export async function getAdminNotification(id: number): Promise<AdminNotification | null> {
  const [notification] = await selectAdminNotifications(eq(auditLogs.id, id), 1);
  return notification ?? null;
}

/** An investor update together with the investor it belongs to. */
type AddressedInvestorNotification = {
  userId: string;
  email: string;
  investorCode: string | null;
  notification: InvestorNotification;
};

const REQUEST_DECISIONS = [
  "deposit.reconciled",
  "deposit.rejected",
  "withdrawal.approved",
  "withdrawal.rejected",
] as const satisfies readonly InvestorNotification["type"][];

/**
 * Investor updates read from the activity log, newest first. The recipient always comes from the database: the
 * decided deposit or withdrawal's account owner, or, for a booked month, every investor with a return posting in it
 * (each with their own amount).
 */
async function selectInvestorNotifications(filter: SQL, limit: number): Promise<AddressedInvestorNotification[]> {
  const db = getDb();
  const [decisions, bookings] = await Promise.all([
    db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        createdAt: auditLogs.createdAt,
        userId: accounts.userId,
        email: users.email,
        investorCode: users.investorCode,
        depositReference: deposits.reference,
        creditedCents: sql<number | null>`${deposits.amountCents} - ${deposits.feeCents}`.mapWith(Number),
        withdrawalReference: withdrawals.reference,
        payoutCents: withdrawals.amountCents,
      })
      .from(auditLogs)
      .leftJoin(deposits, and(eq(auditLogs.entityType, "deposit"), sql`${auditLogs.entityId} = ${deposits.id}::text`))
      .leftJoin(
        withdrawals,
        and(eq(auditLogs.entityType, "withdrawal"), sql`${auditLogs.entityId} = ${withdrawals.id}::text`),
      )
      .innerJoin(accounts, sql`${accounts.id} = coalesce(${deposits.accountId}, ${withdrawals.accountId})`)
      .innerJoin(users, eq(users.id, accounts.userId))
      .where(and(inArray(auditLogs.action, [...REQUEST_DECISIONS]), filter))
      .orderBy(desc(auditLogs.id))
      .limit(limit),
    db
      .select({
        id: auditLogs.id,
        createdAt: auditLogs.createdAt,
        userId: accounts.userId,
        email: users.email,
        investorCode: users.investorCode,
        month: sql<string>`to_char(${returnPeriods.periodStart}, 'YYYY-MM')`,
        returnCents: ledgerEntries.amountCents,
      })
      .from(auditLogs)
      .innerJoin(
        returnPeriods,
        and(eq(auditLogs.entityType, "return_period"), sql`${auditLogs.entityId} = ${returnPeriods.id}::text`),
      )
      .innerJoin(ledgerEntries, eq(ledgerEntries.returnPeriodId, returnPeriods.id))
      .innerJoin(accounts, eq(ledgerEntries.accountId, accounts.id))
      .innerJoin(users, eq(users.id, accounts.userId))
      .where(and(eq(auditLogs.action, "returns.booked"), filter))
      .orderBy(desc(auditLogs.id))
      .limit(limit),
  ]);

  const addressed: AddressedInvestorNotification[] = [
    ...decisions.flatMap((row) =>
      isInvestorNotificationType(row.action)
        ? [
            {
              userId: row.userId,
              email: row.email,
              investorCode: row.investorCode,
              notification: {
                id: row.id,
                type: row.action,
                createdAt: row.createdAt.toISOString(),
                amountCents: row.depositReference !== null ? row.creditedCents : row.payoutCents,
                reference: row.depositReference ?? row.withdrawalReference,
                month: null,
              },
            },
          ]
        : [],
    ),
    ...bookings.map((row) => ({
      userId: row.userId,
      email: row.email,
      investorCode: row.investorCode,
      notification: {
        id: row.id,
        type: "returns.booked" as const,
        createdAt: row.createdAt.toISOString(),
        amountCents: row.returnCents,
        reference: null,
        month: row.month,
      },
    })),
  ];
  return addressed.sort((left, right) => right.notification.id - left.notification.id);
}

/** The investor's updates logged after `afterId` (newest first), to replay what a reconnecting browser missed. */
export async function listInvestorNotifications(options: {
  userId: string;
  afterId: number;
  limit: number;
}): Promise<InvestorNotification[]> {
  // Always scoped to the signed-in investor's own account.
  const addressed = await selectInvestorNotifications(
    sql`${accounts.userId} = ${options.userId} and ${auditLogs.id} > ${options.afterId}`,
    options.limit,
  );
  return addressed.slice(0, options.limit).map((entry) => entry.notification);
}

export function listInvestorsForNotification(auditLogId: number) {
  return selectInvestorNotifications(eq(auditLogs.id, auditLogId), Number.MAX_SAFE_INTEGER);
}

/** Who must hear about one activity-log entry: the admin view, and the investors it concerns. */
export async function getLiveEvent(auditLogId: number): Promise<{
  admin: AdminNotification | null;
  investors: AddressedInvestorNotification[];
}> {
  const [admin, investors] = await Promise.all([
    getAdminNotification(auditLogId),
    listInvestorsForNotification(auditLogId),
  ]);
  return { admin, investors };
}

/** Id of the newest activity-log entry (0 when empty): the starting point of a page's live stream. */
export async function getLatestAuditLogId(): Promise<number> {
  const [{ latestId }] = await getDb()
    .select({ latestId: max(auditLogs.id) })
    .from(auditLogs);
  return latestId ?? 0;
}
