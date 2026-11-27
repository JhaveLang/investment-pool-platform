import { Popup } from "@/components/ui/popup";
import { buttonStyles } from "@/components/ui/button";
import { getI18n } from "@/i18n/server";
import { cn } from "@/lib/cn";
import { statementVarianceCents, type StatementFigures, type StatementMovement } from "@/lib/statements";

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
    <span className={cn("amount font-medium", cents < 0 ? "text-loss" : "text-gain")}>
      {format.signedCurrency(cents)}
    </span>
  );
}

export async function StatementClosingAmount({ statement }: { statement?: StatementFigures }) {
  const difference = statement ? statementVarianceCents(statement) : 0;
  const amount = <StatementAmount cents={statement?.closingCents ?? null} />;
  if (difference === 0) return amount;
  const { messages, format } = await getI18n();
  return (
    <>
      {amount}
      <span className="block text-xs font-medium text-loss">{messages.csv.reviewDifference(format.signedCurrency(difference))}</span>
    </>
  );
}

/** How many movements the cell shows before "+N"; the popup lists them all. */
const TRIMMED_MOVEMENTS = 2;

function MovementAmount({ movement, label }: { movement: StatementMovement; label: string }) {
  return <span className={cn("amount", movement.amountCents < 0 ? "text-loss" : "text-gain")}>{label}</span>;
}

type StatementMovementsProps = {
  movements: StatementMovement[];
  investorName: string;
  periodLabel: string;
};

/**
 * The month's movements, newest first, trimmed to one line ("+1.074,00 € (26.09.) … +2"); a click opens
 * a popup with all of them, their reference and status, and the booked total. Open requests are marked.
 */
export async function StatementMovements({ movements, investorName, periodLabel }: StatementMovementsProps) {
  const { messages, format } = await getI18n();
  if (movements.length === 0) {
    return <span className="text-subtle">{messages.common.emptyValue}</span>;
  }
  const text = messages.admin.investorMonth;
  const hidden = movements.length - TRIMMED_MOVEMENTS;
  const sum = (list: StatementMovement[]) => list.reduce((total, movement) => total + movement.amountCents, 0);
  const booked = movements.filter((movement) => movement.booked);
  const open = movements.filter((movement) => movement.pending && !movement.booked);

  return (
    <Popup
      title={text.miscTitle(periodLabel)}
      description={text.miscDescription(investorName)}
      triggerLabel={text.showMisc(investorName, periodLabel)}
      triggerClassName={buttonStyles({ variant: "ghost", size: "sm", className: "-mx-1.5 gap-3 px-1.5 text-left font-normal whitespace-nowrap" })}
      trigger={
        <>
          {movements.slice(0, TRIMMED_MOVEMENTS).map((movement) => (
            <span key={`${movement.kind}-${movement.reference}`}>
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
          <li key={`${movement.kind}-${movement.reference}`} className="flex items-start justify-between gap-4 py-2.5 text-sm">
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
                  : movement.kind === "withdrawal" ? messages.withdrawalStatus[movement.status] : messages.admin.promos.statusBooked}
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
