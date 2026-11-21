import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHeaderCell } from "@/components/ui/table";
import { getI18n, type I18n } from "@/i18n/server";
import type { AuditLogRow } from "@/server/queries/admin";
import { InvestorCode } from "./investor-code";

/** Turns the structured metadata into short human-readable details, one per line. */
function describeEntry({ entityType, entityId, metadata }: AuditLogRow, { messages, format }: I18n): string[] {
  const reportTitles: Record<string, { title: string }> = messages.admin.reports;
  const details: string[] = [];
  if (entityType === "report" && entityId && reportTitles[entityId]) {
    details.push(reportTitles[entityId].title);
  }
  if (typeof metadata.reference === "string") {
    details.push(metadata.reference);
  }
  if (typeof metadata.amountCents === "number") {
    details.push(format.currency(metadata.amountCents));
  }
  if (typeof metadata.month === "string" && typeof metadata.ratePpm === "number") {
    details.push(`${format.month(metadata.month)}: ${format.rate(metadata.ratePpm)}`);
  }
  if (typeof metadata.totalCents === "number") {
    details.push(format.signedCurrency(metadata.totalCents));
  }
  if (typeof metadata.receivedOn === "string") {
    details.push(messages.deposits.receivedOn(format.calendarDate(metadata.receivedOn)));
  }
  if (entityType === "user" && typeof metadata.investorName === "string") {
    const code = typeof metadata.investorCode === "string" ? ` (${metadata.investorCode})` : "";
    details.push(`${metadata.investorName}${code}`);
  }
  const changes = entityType === "user" ? describeChanges(metadata.changes, messages.profile) : [];
  details.push(...changes);
  if (typeof metadata.email === "string") {
    details.push(metadata.email);
  }
  if (typeof metadata.from === "string" || typeof metadata.to === "string") {
    details.push(`${metadata.from ?? "…"} – ${metadata.to ?? "…"}`);
  }
  if (typeof metadata.note === "string") {
    details.push(messages.common.quoted(metadata.note));
  }
  return details;
}

type FieldChange = { from: unknown; to: unknown };

function isFieldChange(value: unknown): value is FieldChange {
  return typeof value === "object" && value !== null && "from" in value && "to" in value;
}

/** "Name: from → to" lines for the changed fields of a `user.updated` entry. */
function describeChanges(changes: unknown, labels: { name: string; email: string }): string[] {
  if (typeof changes !== "object" || changes === null) {
    return [];
  }
  const fields = [
    { key: "fullName", label: labels.name },
    { key: "email", label: labels.email },
  ];
  return fields.flatMap(({ key, label }) => {
    const change: unknown = (changes as Record<string, unknown>)[key];
    return isFieldChange(change) ? [`${label}: ${String(change.from)} → ${String(change.to)}`] : [];
  });
}

export async function ActivityLogTable({ entries }: { entries: AuditLogRow[] }) {
  const i18n = await getI18n();
  const { messages, format } = i18n;
  const text = messages.audit;

  if (entries.length === 0) {
    return <EmptyState title={messages.admin.activityEmpty} />;
  }
  return (
    <Table>
      <thead>
        <tr>
          <TableHeaderCell>{text.columns.time}</TableHeaderCell>
          <TableHeaderCell>{text.columns.actor}</TableHeaderCell>
          <TableHeaderCell>{text.columns.action}</TableHeaderCell>
          <TableHeaderCell>{text.columns.details}</TableHeaderCell>
          <TableHeaderCell>{text.columns.ipAddress}</TableHeaderCell>
        </tr>
      </thead>
      <TableBody>
        {entries.map((entry) => (
          <tr key={entry.id}>
            <TableCell className="whitespace-nowrap">{format.dateTime(entry.createdAt)}</TableCell>
            <TableCell>
              {entry.actorName ? (
                <>
                  <p className="font-medium text-fg">
                    {entry.actorName} <InvestorCode code={entry.actorInvestorCode} />
                  </p>
                  <p className="text-xs text-subtle">{entry.actorEmail}</p>
                </>
              ) : (
                <span className="text-subtle">{text.system}</span>
              )}
            </TableCell>
            <TableCell className="whitespace-nowrap">{text.actions[entry.action] ?? entry.action}</TableCell>
            <TableCell className="text-xs text-muted">
              <ActivityDetails details={describeEntry(entry, i18n)} emptyValue={messages.common.emptyValue} />
            </TableCell>
            <TableCell className="reference text-xs text-subtle">
              {entry.ipAddress ?? messages.common.emptyValue}
            </TableCell>
          </tr>
        ))}
      </TableBody>
    </Table>
  );
}

function ActivityDetails({ details, emptyValue }: { details: string[]; emptyValue: string }) {
  if (details.length === 0) {
    return emptyValue;
  }
  return (
    <ul className="space-y-0.5">
      {details.map((detail) => (
        <li key={detail}>{detail}</li>
      ))}
    </ul>
  );
}
