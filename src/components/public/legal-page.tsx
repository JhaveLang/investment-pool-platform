import { Alert } from "@/components/ui/alert";
import { LEGAL_TEMPLATES_PENDING, legalDocuments, type LegalPage } from "@/content/legal";
import { getI18n } from "@/i18n/server";
import { cn } from "@/lib/cn";
import { PublicPageHeader } from "./public-page-header";
import { publicContainer } from "./site-layout";

/** Impressum or privacy policy in the visitor's language. */
export async function LegalPageContent({ page, title }: { page: LegalPage; title: string }) {
  const { messages, locale } = await getI18n();
  const document = legalDocuments[page][locale];

  return (
    <>
      <PublicPageHeader title={title} description={document.intro} />
      <div className={cn(publicContainer, "py-10 sm:py-14")}>
        <div className="max-w-3xl space-y-8">
          {LEGAL_TEMPLATES_PENDING ? <Alert tone="warning">{messages.site.templateNotice}</Alert> : null}
          {document.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="font-display text-lg font-semibold text-accent-400">{section.heading}</h2>
              <div className="mt-2 space-y-2 text-[15px] leading-relaxed text-muted">
                {section.lines ? (
                  <p>
                    {section.lines.map((line, index) => (
                      <span key={index} className="block">
                        {line}
                      </span>
                    ))}
                  </p>
                ) : null}
                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {section.items ? (
                  <ul className="list-disc space-y-1 pl-5 marker:text-subtle">
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
