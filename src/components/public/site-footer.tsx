import Link from "next/link";
import { Brand } from "@/components/layout/brand";
import { SITE } from "@/config/site";
import { getI18n } from "@/i18n/server";
import { todayIsoDate } from "@/lib/calendar";
import { cn } from "@/lib/cn";
import { getAccountLink } from "./site-header";
import { publicContainer } from "./site-layout";

export async function SiteFooter() {
  const { messages } = await getI18n();
  const text = messages.site;
  const account = await getAccountLink();
  const linkStyles = "text-muted transition-colors hover:text-fg";
  const columns = [
    [
      { href: "/", label: text.home },
      { href: "/services", label: text.services },
      { href: "/faq", label: text.faq },
      { href: "/news", label: text.news },
      { href: "/contact", label: text.contact },
      account,
    ],
    [
      { href: "/imprint", label: text.imprint },
      { href: "/privacy", label: text.privacy },
      { href: SITE.trustpilotUrl, label: text.trustpilot },
    ],
  ];

  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <div className={cn(publicContainer, "grid gap-10 py-12 md:grid-cols-[minmax(0,1fr)_auto]")}>
        <div>
          <Brand />
          <p className="mt-3 max-w-sm text-sm text-muted">{text.tagline}</p>
          <a href={`mailto:${SITE.contactEmail}`} className={cn(linkStyles, "mt-4 inline-block text-sm")}>
            {SITE.contactEmail}
          </a>
        </div>
        <nav aria-label={text.footerNav} className="grid grid-cols-2 gap-x-12 gap-y-2.5 text-sm">
          {columns.map((links, index) => (
            <ul key={index} className="space-y-2.5">
              {links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={linkStyles}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          ))}
        </nav>
      </div>
      <div className="bg-footer">
        <p className={cn(publicContainer, "py-5 text-xs text-white/80")}>
          {text.copyright(SITE.copyrightSince, Number(todayIsoDate().slice(0, 4)))}
        </p>
      </div>
    </footer>
  );
}
