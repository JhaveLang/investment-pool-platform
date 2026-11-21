import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./icon";

export function Card({ className, ...divProps }: ComponentProps<"div">) {
  return <div className={cn("rounded-xl border border-line bg-surface", className)} {...divProps} />;
}

type CardHeaderProps = {
  title: string;
  description?: string;
  icon?: IconName;
  action?: ReactNode;
};

export function CardHeader({ title, description, icon, action }: CardHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 pt-5 pb-4">
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-raised text-accent-400">
            <Icon name={icon} className="size-[18px]" />
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="font-display text-lg leading-tight font-semibold tracking-tight text-fg">{title}</h2>
          {description ? <p className="mt-1 max-w-prose text-[13px] text-muted">{description}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}

export function CardContent({ className, ...divProps }: ComponentProps<"div">) {
  return <div className={cn("px-5 pb-5", className)} {...divProps} />;
}

/** The emerald caps "Alle anzeigen" link in a card header. */
export function CardLink({ className, ...linkProps }: ComponentProps<typeof Link>) {
  return (
    <Link
      className={cn("label-caps shrink-0 text-accent-400 transition-colors hover:text-accent-300", className)}
      {...linkProps}
    />
  );
}
