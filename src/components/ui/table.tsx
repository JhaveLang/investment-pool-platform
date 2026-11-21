import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/** Horizontally scrollable on small screens so wide tables never break the layout. */
export function Table({ className, ...tableProps }: ComponentProps<"table">) {
  return (
    <div className="overflow-x-auto">
      <table className={cn("min-w-full text-sm", className)} {...tableProps} />
    </div>
  );
}

export function TableHeaderCell({ className, ...cellProps }: ComponentProps<"th">) {
  return (
    <th
      scope="col"
      className={cn(
        "label-caps bg-raised px-3 py-3 text-left whitespace-nowrap text-subtle first:pl-5 last:pr-5",
        className,
      )}
      {...cellProps}
    />
  );
}

export function TableCell({ className, ...cellProps }: ComponentProps<"td">) {
  return <td className={cn("px-3 py-3.5 align-middle text-muted first:pl-5 last:pr-5", className)} {...cellProps} />;
}

export function TableBody({ className, ...bodyProps }: ComponentProps<"tbody">) {
  return (
    <tbody
      className={cn("divide-y divide-line [&>tr]:transition-colors [&>tr:hover]:bg-raised/50", className)}
      {...bodyProps}
    />
  );
}
