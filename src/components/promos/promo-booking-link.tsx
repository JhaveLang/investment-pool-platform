"use client";

import Link from "next/link";
import { unstable_rethrow, useRouter } from "next/navigation";
import { useTransition } from "react";
import { checkPromoBookingAction } from "@/actions/promos";
import { useInvestorToast } from "@/components/layout/investor-live-updates";
import { buttonStyles } from "@/components/ui/button";
import { useMessages } from "@/i18n/client";

export function PromoBookingLink({ promoId }: { promoId: string }) {
  const router = useRouter();
  const showToast = useInvestorToast();
  const messages = useMessages();
  const text = messages.admin.promos;
  const [pending, startTransition] = useTransition();
  const href = `/promos/${promoId}/book`;

  return (
    <Link
      href={href}
      prefetch={false}
      className={buttonStyles({ className: "mt-5" })}
      aria-busy={pending}
      onNavigate={(event) => {
        event.preventDefault();
        if (pending) return;
        startTransition(async () => {
          let issue;
          try {
            issue = await checkPromoBookingAction(promoId);
          } catch (error) {
            unstable_rethrow(error);
            issue = { message: messages.errors.generic, showBalanceDetails: false };
          }
          if (!issue) {
            router.push(href);
            return;
          }
          showToast({
            icon: "lock",
            iconTone: "text-warn",
            label: text.bookingUnavailable,
            children: issue.message,
            href: issue.showBalanceDetails ? href : "/dashboard",
            linkLabel: issue.showBalanceDetails ? text.viewBalanceDetails : messages.nav.dashboard,
          });
        });
      }}
    >
      {text.bookPromo}
    </Link>
  );
}
