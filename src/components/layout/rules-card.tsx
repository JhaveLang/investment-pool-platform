import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { getI18n } from "@/i18n/server";
import { ACCRUAL_DELAY_DAYS, MINIMUM_TERM_DAYS, PAYOUT_DEADLINE_DAYS } from "@/lib/returns";
import type { UserRole } from "@/server/db/schema";

/** The sidebar's small fact card: the pool rules for investors, the month-end routine for admins. */
export async function RulesCard({ role }: { role: UserRole }) {
  const { messages } = await getI18n();
  const text = messages.nav;
  const rows =
    role === "admin"
      ? [
          { label: text.ruleMonthEnd, value: text.ruleMonthEndValue },
          { label: text.rulePayout, value: text.ruleWithinDays(PAYOUT_DEADLINE_DAYS) },
        ]
      : [
          { label: text.ruleMinimumTerm, value: text.ruleDays(MINIMUM_TERM_DAYS) },
          { label: text.ruleAccrual, value: text.ruleFromDay(ACCRUAL_DELAY_DAYS) },
          { label: text.rulePayout, value: text.ruleWithinDays(PAYOUT_DEADLINE_DAYS) },
        ];

  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-raised p-3">
      <div className="flex items-center justify-between text-muted">
        <span className="label-caps">{role === "admin" ? text.monthEndTitle : text.rulesTitle}</span>
        <Icon name="shieldCheck" className="size-4 text-accent-400" />
      </div>
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between gap-2 text-[13px]">
          <span className="text-muted">{row.label}</span>
          <span className="font-semibold text-accent-400">{row.value}</span>
        </div>
      ))}
      {role === "admin" ? (
        <Link href="/admin/returns" className="label-caps mt-1 text-accent-400 hover:text-accent-300">
          {text.monthEndCta}
        </Link>
      ) : null}
    </div>
  );
}
