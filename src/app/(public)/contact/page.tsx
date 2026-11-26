import Link from "next/link";
import { PublicPageHeader } from "@/components/public/public-page-header";
import { getAccountLink } from "@/components/public/site-header";
import { publicContainer } from "@/components/public/site-layout";
import { buttonStyles } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { SITE } from "@/config/site";
import { getI18n, pageMetadata } from "@/i18n/server";
import { cn } from "@/lib/cn";

export const generateMetadata = pageMetadata((messages) => messages.site.contactPageTitle);

/** The two email addresses: general enquiries, and the billing team that sends the statements (no replies). */
export default async function ContactPage() {
  const { messages } = await getI18n();
  const text = messages.site;
  const account = await getAccountLink();
  const channels: Array<{ icon: IconName; title: string; text: string; email: string }> = [
    { icon: "send", title: text.generalTitle, text: text.generalText, email: SITE.contactEmail },
    { icon: "file", title: text.billingTitle, text: text.billingText, email: SITE.billingEmail },
  ];

  return (
    <>
      <PublicPageHeader title={text.contactPageTitle} description={text.contactPageSubtitle} />
      <div className={cn(publicContainer, "py-10 sm:py-14")}>
        <div className="grid max-w-4xl gap-4 md:grid-cols-2">
          {channels.map((channel) => (
            <section key={channel.email} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-6">
              <span className="grid size-10 place-items-center rounded-lg bg-accent-400/10 text-accent-400">
                <Icon name={channel.icon} className="size-5" />
              </span>
              <h2 className="font-display text-lg font-semibold text-accent-300">{channel.title}</h2>
              <p className="text-sm text-muted">{channel.text}</p>
              <a
                href={`mailto:${channel.email}`}
                className="mt-auto text-[15px] font-semibold break-all text-accent-400 hover:underline"
              >
                {channel.email}
              </a>
            </section>
          ))}
        </div>
        <div className="mt-8 flex max-w-4xl flex-col gap-4 rounded-2xl bg-raised p-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">{text.investorHint}</p>
          <Link href={account.href} className={buttonStyles({ className: "shrink-0" })}>
            <Icon name="lock" className="size-4" />
            {account.label}
          </Link>
        </div>
      </div>
    </>
  );
}
