import { buttonStyles } from "@/components/ui/button";
import { labelStyles } from "@/components/ui/form-field";
import { Icon } from "@/components/ui/icon";
import { Popup } from "@/components/ui/popup";
import { Select } from "@/components/ui/select";
import { getI18n } from "@/i18n/server";
import type { IsoMonth } from "@/lib/calendar";
import { keepsPage } from "@/lib/keeps-page";

type StatementExportProps = {
  /** The CSV route. */
  action: string;
  title: string;
  description: string;
  /** The months to choose from, newest first. */
  months: IsoMonth[];
  defaultFrom: IsoMonth;
  defaultTo: IsoMonth;
  /** Filters passed on unchanged, e.g. the investor list's status and search. */
  hidden?: Record<string, string | undefined>;
};

/**
 * "CSV" button with a popup to choose the month range. A plain GET form, so the browser downloads the file and the
 * page stays as it is; the popup closes on download.
 */
export async function StatementExport({
  action,
  title,
  description,
  months,
  defaultFrom,
  defaultTo,
  hidden = {},
}: StatementExportProps) {
  const { messages, format } = await getI18n();
  const text = messages.admin.investorExport;
  const options = months.map((month) => (
    <option key={month} value={month}>
      {format.month(month)}
    </option>
  ));

  return (
    <Popup
      title={title}
      description={description}
      closeOnSubmit
      triggerClassName={buttonStyles({ variant: "secondary" })}
      trigger={
        <>
          <Icon name="download" className="size-4" />
          {text.button}
        </>
      }
    >
      {/* A download: the page stays, so unsaved changes on it don't hold the export. */}
      <form action={action} method="get" className="space-y-4" {...keepsPage}>
        {Object.entries(hidden).map(([name, value]) =>
          value ? <input key={name} type="hidden" name={name} value={value} /> : null,
        )}
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={labelStyles}>{text.from}</span>
            <Select name="from" defaultValue={defaultFrom}>
              {options}
            </Select>
          </label>
          <label className="block">
            <span className={labelStyles}>{text.to}</span>
            <Select name="to" defaultValue={defaultTo}>
              {options}
            </Select>
          </label>
        </div>
        <button type="submit" className={buttonStyles({ className: "w-full" })}>
          <Icon name="download" className="size-4" />
          {text.download}
        </button>
      </form>
    </Popup>
  );
}
