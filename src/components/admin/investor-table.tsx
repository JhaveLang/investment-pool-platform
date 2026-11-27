import Link from "next/link";
import { setInvestorStatusAction } from "@/actions/account";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { Table, TableBody, TableCell, TableHeaderCell } from "@/components/ui/table";
import { getI18n } from "@/i18n/server";
import type { IsoMonth } from "@/lib/calendar";
import type { MonthStatement } from "@/lib/statements";
import type { InvestorRow } from "@/server/queries/admin";
import { EditableInvestorCode } from "./investor-code-editor";
import { InvestorStatusButton } from "./investor-status-button";
import { StatementAmount, StatementMovements } from "./statement-cells";

// When the table is wider than the screen it scrolls sideways; the actions stay pinned to the right edge so they are
// always in reach (where everything fits, pinning changes nothing).
const pinnedActions = "sticky right-0 shadow-[-12px_0_12px_-12px_rgba(29,22,33,0.16)]";

type InvestorTableProps = {
  investors: InvestorRow[];
  /** The month the investment, return and miscellaneous columns refer to. */
  month: IsoMonth;
  /** Monthly statement per account id. */
  statements: Record<string, MonthStatement>;
};

/**
 * The investor list with the chosen month's figures, and view / edit / deactivate actions per row. A click on an
 * investor ID edits it in place; render it inside an `InvestorCodeEditor`.
 */
export async function InvestorTable({ investors, month, statements }: InvestorTableProps) {
  const { messages, format } = await getI18n();
  const columns = messages.columns;
  const monthText = messages.admin.investorMonth;
  const actions = messages.admin.investorActions;
  const exportText = messages.admin.investorExport;
  const monthLabel = format.monthShort(month);

  if (investors.length === 0) {
    return <EmptyState title={messages.admin.investorsEmpty} />;
  }
  return (
    <Table>
      <thead>
        <tr>
          <TableHeaderCell>{columns.investorId}</TableHeaderCell>
          <TableHeaderCell>{columns.investor}</TableHeaderCell>
          <TableHeaderCell className="text-right">{columns.balance}</TableHeaderCell>
          <TableHeaderCell className="text-right">{monthText.investmentOn(monthLabel)}</TableHeaderCell>
          <TableHeaderCell className="text-right">{monthText.returnFor(monthLabel)}</TableHeaderCell>
          <TableHeaderCell>{monthText.miscFor(monthLabel)}</TableHeaderCell>
          <TableHeaderCell>{columns.registeredAt}</TableHeaderCell>
          <TableHeaderCell className={pinnedActions}>{columns.actions}</TableHeaderCell>
        </tr>
      </thead>
      <TableBody>
        {investors.map((investor) => {
          const statement = statements[investor.accountId];
          return (
            <tr key={investor.id}>
              <TableCell className="whitespace-nowrap">
                <EditableInvestorCode
                  userId={investor.id}
                  code={investor.investorCode}
                  investorName={investor.fullName}
                />
              </TableCell>
              <TableCell className="font-medium text-fg">
                <span className="flex flex-wrap items-center gap-2">
                  {investor.fullName}
                  {investor.deactivatedAt ? <Badge>{messages.investorStatus.deactivated}</Badge> : null}
                </span>
              </TableCell>
              <TableCell className="amount text-right font-medium whitespace-nowrap text-fg">
                {format.currency(investor.balanceCents)}
              </TableCell>
              <TableCell className="text-right whitespace-nowrap text-fg">
                <StatementAmount cents={statement?.openingCents ?? null} />
              </TableCell>
              <TableCell className="text-right whitespace-nowrap">
                <StatementAmount cents={statement?.returnCents ?? null} signed />
              </TableCell>
              <TableCell>
                <StatementMovements
                  movements={statement?.movements ?? []}
                  investorName={investor.fullName}
                  month={month}
                />
              </TableCell>
              <TableCell className="whitespace-nowrap">{format.date(investor.createdAt)}</TableCell>
              <TableCell className={`${pinnedActions} bg-surface`}>
                <div className="flex items-start gap-2">
                  <Link
                    href={`/admin/investors/${investor.id}`}
                    aria-label={actions.viewInvestor(investor.fullName)}
                    title={actions.view}
                    className={buttonStyles({ size: "iconSm" })}
                  >
                    <Icon name="eye" className="size-4" />
                  </Link>
                  <Link
                    href={`/admin/investors/${investor.id}/edit`}
                    aria-label={actions.editInvestor(investor.fullName)}
                    title={actions.edit}
                    className={buttonStyles({ variant: "secondary", size: "iconSm" })}
                  >
                    <Icon name="pencil" className="size-4" />
                  </Link>
                  {/* A plain link: the file is a download, and a Link would prefetch it (and log an export). */}
                  <a
                    href={`/api/admin/investors/${investor.id}/statement`}
                    download
                    aria-label={exportText.rowLabel(investor.fullName)}
                    title={exportText.rowTitle}
                    className={buttonStyles({ variant: "secondary", size: "iconSm" })}
                  >
                    <Icon name="download" className="size-4" />
                  </a>
                  <InvestorStatusButton
                    action={setInvestorStatusAction.bind(null, investor.id)}
                    active={investor.deactivatedAt === null}
                    investorName={investor.fullName}
                  />
                </div>
              </TableCell>
            </tr>
          );
        })}
      </TableBody>
    </Table>
  );
}
