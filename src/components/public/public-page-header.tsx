import { cn } from "@/lib/cn";
import { publicContainer } from "./site-layout";

/** Title band of a website page below the start page. */
export function PublicPageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="border-b border-line bg-sidebar/40">
      <div className={cn(publicContainer, "py-12 sm:py-16")}>
        <h1 className="font-display text-[34px] leading-tight font-bold tracking-[-0.02em] text-fg sm:text-[44px]">
          {title}
        </h1>
        {description ? <p className="mt-3 max-w-2xl text-base text-muted">{description}</p> : null}
      </div>
    </div>
  );
}
