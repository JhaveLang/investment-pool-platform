import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHeaderCell } from "@/components/ui/table";
import { getI18n } from "@/i18n/server";
import type { InvestorRow } from "@/server/queries/admin";

export async function InvestorTable({ investors }: { investors: InvestorRow[] }) {
  const { messages, format } = await getI18n();
  const columns = messages.columns;

  if (investors.length === 0) {
    return <EmptyState title={messages.admin.investorsEmpty} />;
  }
  return (
    <Table>
      <thead>
        <tr>
          <TableHeaderCell>{columns.investorId}</TableHeaderCell>
          <TableHeaderCell>{columns.investor}</TableHeaderCell>
          <TableHeaderCell>{columns.email}</TableHeaderCell>
          <TableHeaderCell className="text-right">{columns.balance}</TableHeaderCell>
          <TableHeaderCell>{columns.registeredAt}</TableHeaderCell>
          <TableHeaderCell>{columns.lastLoginAt}</TableHeaderCell>
        </tr>
      </thead>
      <TableBody>
        {investors.map((investor) => (
          <tr key={investor.id}>
            <TableCell className="whitespace-nowrap">
              <span className="reference">{investor.investorCode}</span>
            </TableCell>
            <TableCell className="font-medium text-fg">
              <span className="flex flex-wrap items-center gap-2">
                <Link href={`/admin/investors/${investor.id}`} className="hover:text-accent-400 hover:underline">
                  {investor.fullName}
                </Link>
                {investor.deactivatedAt ? <Badge>{messages.investorStatus.deactivated}</Badge> : null}
              </span>
            </TableCell>
            <TableCell>{investor.email}</TableCell>
            <TableCell className="amount text-right font-medium text-fg">
              {format.currency(investor.balanceCents)}
            </TableCell>
            <TableCell className="whitespace-nowrap">{format.date(investor.createdAt)}</TableCell>
            <TableCell className="whitespace-nowrap">
              {investor.lastLoginAt ? format.dateTime(investor.lastLoginAt) : messages.common.emptyValue}
            </TableCell>
          </tr>
        ))}
      </TableBody>
    </Table>
  );
}
