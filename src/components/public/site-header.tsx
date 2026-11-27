import Link from "next/link";
import { Brand } from "@/components/layout/brand";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { buttonStyles } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { getI18n } from "@/i18n/server";
import { cn } from "@/lib/cn";
import { homePathForRole } from "@/server/auth/guards";
import { getCurrentUser } from "@/server/auth/session";
import { PublicMobileMenu, PublicNav, type PublicNavItem } from "./public-nav";
import { publicContainer } from "./site-layout";

/** Where "Konten" leads: the sign-in page, or the own account when already signed in. */
export async function getAccountLink(): Promise<{ href: string; label: string }> {
  const [{ messages }, user] = await Promise.all([getI18n(), getCurrentUser()]);
  return user
    ? { href: homePathForRole(user.role), label: messages.site.myAccount }
    : { href: "/login", label: messages.site.signIn };
}

export async function SiteHeader() {
  const { messages } = await getI18n();
  const text = messages.site;
  const account = await getAccountLink();
  const items: PublicNavItem[] = [
    { href: "/", label: text.home },
    { href: "/services", label: text.services },
    { href: "/faq", label: text.faq },
    { href: "/news", label: text.news },
    { href: "/contact", label: text.contact },
  ];
  const accountButton = (className?: string) => (
    <Link href={account.href} className={buttonStyles({ size: "sm", className })}>
      <Icon name="lock" className="size-4" />
      {account.label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/95 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className={cn(publicContainer, "relative flex h-16 items-center justify-between gap-4")}>
        <Brand />
        <div className="hidden items-center gap-5 lg:flex">
          <PublicNav items={items} label={text.navLabel} />
          <LocaleSwitcher />
          {accountButton()}
        </div>
        <div className="lg:hidden">
          <PublicMobileMenu items={items} label={text.menu}>
            {accountButton()}
            <LocaleSwitcher />
          </PublicMobileMenu>
        </div>
      </div>
    </header>
  );
}
