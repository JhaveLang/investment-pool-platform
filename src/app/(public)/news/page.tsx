import { PublicPageHeader } from "@/components/public/public-page-header";
import { publicContainer } from "@/components/public/site-layout";
import { sortedNews } from "@/content/news";
import { getI18n, pageMetadata } from "@/i18n/server";
import { cn } from "@/lib/cn";

export const generateMetadata = pageMetadata((messages) => messages.site.newsTitle);

/** Operational notices, newest first and grouped by year (entries live in `src/content/news.ts`). */
export default async function NewsPage() {
  const { messages, format, locale } = await getI18n();
  const text = messages.site;
  const years = new Map<string, ReturnType<typeof sortedNews>>();
  for (const entry of sortedNews()) {
    const year = entry.date.slice(0, 4);
    years.set(year, [...(years.get(year) ?? []), entry]);
  }

  return (
    <>
      <PublicPageHeader title={text.newsTitle} description={text.newsSubtitle} />
      <div className={cn(publicContainer, "py-10 sm:py-14")}>
        {years.size === 0 ? (
          <p className="text-sm text-subtle">{text.newsEmpty}</p>
        ) : (
          <div className="max-w-3xl space-y-10">
            {[...years].map(([year, entries]) => (
              <section key={year} aria-labelledby={`news-${year}`}>
                <h2 id={`news-${year}`} className="label-caps text-subtle">
                  {year}
                </h2>
                <ol className="mt-3 divide-y divide-line rounded-2xl border border-line bg-surface">
                  {entries.map((entry) => (
                    <li
                      key={`${entry.date}-${entry.text.de}`}
                      className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:gap-6"
                    >
                      <time dateTime={entry.date} className="shrink-0 text-sm font-medium text-accent-400 sm:w-28">
                        {format.calendarDate(entry.date)}
                      </time>
                      <p className="text-[15px] leading-relaxed text-fg">{entry.text[locale]}</p>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
