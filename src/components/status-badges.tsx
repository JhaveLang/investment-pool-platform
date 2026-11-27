import { Badge, type BadgeTone } from "@/components/ui/badge";
import { getI18n } from "@/i18n/server";
import { cn } from "@/lib/cn";
import type { DepositStatus, LedgerEntryType, WithdrawalStatus } from "@/server/db/schema";
import type { LedgerRow } from "@/server/queries/ledger";

const depositTones: Record<DepositStatus, BadgeTone> = {
  pending: "warning",
  reconciled: "success",
  rejected: "danger",
};

const withdrawalTones: Record<WithdrawalStatus, BadgeTone> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
};

const entryTypeTones: Record<LedgerEntryType, BadgeTone> = {
  deposit: "success",
  withdrawal: "info",
  deposit_reversal: "danger",
  withdrawal_reversal: "neutral",
  deposit_fee: "neutral",
  withdrawal_fee: "neutral",
  monthly_return: "success",
  promo_transfer: "info",
  promo_principal_return: "success",
  promo_return: "success",
};

export async function DepositStatusBadge({ status }: { status: DepositStatus }) {
  const { messages } = await getI18n();
  return <Badge tone={depositTones[status]}>{messages.depositStatus[status]}</Badge>;
}

export async function WithdrawalStatusBadge({ status }: { status: WithdrawalStatus }) {
  const { messages } = await getI18n();
  return <Badge tone={withdrawalTones[status]}>{messages.withdrawalStatus[status]}</Badge>;
}

/** Entry types as plain text; only reversals stand out, in red. */
export async function EntryTypeBadge({ entryType }: { entryType: LedgerEntryType }) {
  const { messages } = await getI18n();
  return (
    <span className={cn(entryTypeTones[entryType] === "danger" ? "text-loss" : "text-fg")}>
      {messages.entryTypes[entryType]}
    </span>
  );
}

/**
 * State of a ledger entry: the review status of its deposit or withdrawal (fees share their
 * parent's), otherwise "Gebucht". Reversals and returns are final the moment they are posted.
 */
export async function EntryStatusBadge({ entry }: { entry: LedgerRow }) {
  const { messages } = await getI18n();
  const isReversal = entry.entryType === "deposit_reversal" || entry.entryType === "withdrawal_reversal";
  if (entry.entryType === "promo_return") {
    return <Badge tone="success">{messages.transactions.booked}</Badge>;
  }
  if (!isReversal && entry.depositStatus) {
    return <DepositStatusBadge status={entry.depositStatus} />;
  }
  if (!isReversal && entry.withdrawalStatus) {
    return <WithdrawalStatusBadge status={entry.withdrawalStatus} />;
  }
  return <Badge tone="success">{messages.transactions.booked}</Badge>;
}
