import { Popup } from "@/components/ui/popup";
import { getI18n } from "@/i18n/server";
import type { IsoMonth } from "@/lib/calendar";
import { cn } from "@/lib/cn";
import type { StatementMovement } from "@/lib/statements";

/** An amount of the monthly statement, or "–" when there is none (nothing booked yet, return not booked). */
export async function StatementAmount({ cents, signed = false }: { cents: number | null; signed?: boolean }) {
  const { messages, format } = await getI18n();
  if (cents === null) {
    return <span className="text-subtle">{messages.common.emptyValue}</span>;
  }
  if (!signed) {
    return <span className="amount">{format.currency(cents)}</span>;
  }
  return (
    <span className={cn("amount font-medium", cents < 0 ? "text-loss" : "text-accent-400")}>
      {format.signedCurrency(cents)}
    </span>
  );
}

/** How many movements the cell shows before "+N"; the popup lists them all. */
const TRIMMED_MOVEMENTS = 2;

function MovementAmount({ movement, label }: { movement: StatementMovement; label: string }) {
  return <span className={cn("amount", movement.amountCents < 0 ? "text-loss" : "text-accent-400")}>{label}</span>;
}

type StatementMovementsProps = {
  movements: StatementMovement[];
  investorName: string;
  month: IsoMonth;
};

/**
 * The month's deposits and withdrawals, newest first, trimmed to one line ("+1.074,00 € (26.09.) … +2"); a click opens
 * a popup with all of them, their reference and status, and the booked total. Open requests are marked.
 */
export async function StatementMovements({ movements, investorName, month }: StatementMovementsProps) {
  const { messages, format } = await getI18n();
  if (movements.length === 0) {
    return <span className="text-subtle">{messages.common.emptyValue}</span>;
  }
  const text = messages.admin.investorMonth;
  const monthLabel = format.month(month);
  const hidden = movements.length - TRIMMED_MOVEMENTS;
  const sum = (list: StatementMovement[]) => list.reduce((total, movement) => total + movement.amountCents, 0);
  const booked = movements.filter((movement) => movement.booked);
  const open = movements.filter((movement) => movement.pending && !movement.booked);

  return (
    <Popup
      title={text.miscTitle(monthLabel)}
      description={text.miscDescription(investorName)}
      triggerLabel={text.showMisc(investorName, monthLabel)}
      triggerClassName="-mx-1.5 flex items-center gap-3 rounded-md px-1.5 py-0.5 text-left text-[13px] whitespace-nowrap transition-colors hover:bg-raised"
      trigger={
        <>
          {movements.slice(0, TRIMMED_MOVEMENTS).map((movement) => (
            <span key={movement.reference}>
              <MovementAmount movement={movement} label={format.signedCurrency(movement.amountCents)} />{" "}
              <span className="text-subtle">
                ({format.dayMonth(movement.valueDate)}
                {movement.pending ? `, ${text.pending}` : ""})
              </span>
            </span>
          ))}
          {hidden > 0 ? (
            <span className="rounded-full bg-raised px-2 py-0.5 text-xs font-semibold text-muted">
              {text.more(hidden)}
            </span>
          ) : null}
        </>
      }
    >
      <ul className="divide-y divide-line border-y border-line">
        {movements.map((movement) => (
          <li key={movement.reference} className="flex items-start justify-between gap-4 py-2.5 text-sm">
            <div className="min-w-0">
              <p className="font-medium text-fg">{messages.entryTypes[movement.kind]}</p>
              <p className="text-xs text-subtle">
                {format.calendarDate(movement.valueDate)} · <span className="reference">{movement.reference}</span>
              </p>
            </div>
            <div className="text-right">
              <p className="font-medium whitespace-nowrap">
                <MovementAmount movement={movement} label={format.signedCurrency(movement.amountCents)} />
              </p>
              <p className="text-xs text-subtle">
                {movement.kind === "deposit"
                  ? messages.depositStatus[movement.status]
                  : messages.withdrawalStatus[movement.status]}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <dl className="mt-3 space-y-1 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted">{text.bookedTotal}</dt>
          <dd className="amount font-semibold text-fg">{format.signedCurrency(sum(booked))}</dd>
        </div>
        {open.length > 0 ? (
          <div className="flex justify-between gap-4">
            <dt className="text-muted">{text.pendingTotal}</dt>
            <dd className="amount text-muted">{format.signedCurrency(sum(open))}</dd>
          </div>
        ) : null}
      </dl>
    </Popup>
  );
}
