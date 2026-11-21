import Link from "next/link";
import { getI18n } from "@/i18n/server";
import { segmentGroupStyles, segmentStyles } from "@/components/ui/segmented";

type StatusFilterProps<Value extends string> = {
  basePath: string;
  current: Value;
  options: Array<{ value: Value; label: string }>;
};

export async function StatusFilter<Value extends string>({ basePath, current, options }: StatusFilterProps<Value>) {
  const { messages } = await getI18n();

  return (
    <nav aria-label={messages.admin.statusFilter.label} className={segmentGroupStyles}>
      {options.map((option) => {
        const isActive = option.value === current;
        return (
          <Link
            key={option.value}
            href={`${basePath}?status=${option.value}`}
            aria-current={isActive ? "page" : undefined}
            className={segmentStyles(isActive)}
          >
            {option.label}
          </Link>
        );
      })}
    </nav>
  );
}
