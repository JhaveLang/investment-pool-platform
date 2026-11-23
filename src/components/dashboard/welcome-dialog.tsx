import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { OneTimeDialog } from "@/components/ui/one-time-dialog";
import { getI18n } from "@/i18n/server";
import { WELCOME_PARAM } from "@/lib/onboarding";
import { MINIMUM_TERM_DAYS, PAYOUT_DEADLINE_DAYS } from "@/lib/returns";

/**
 * Shown once after signing up (and after each sign-in until the first deposit): the account is ready with a zero
 * balance, how a deposit reaches it, and a button straight to the deposit form.
 */
export async function WelcomeDialog({ name, balanceCents }: { name: string; balanceCents: number }) {
  const { messages, format } = await getI18n();
  const text = messages.dashboard.welcome;

  return (
    <OneTimeDialog
      param={WELCOME_PARAM}
      title={text.title(name)}
      description={text.description}
      dismissLabel={text.later}
      action={
        <Link href="/deposit" className={buttonStyles()}>
          <Icon name="plusCircle" className="size-4" />
          {text.firstDeposit}
        </Link>
      }
    >
      <div className="flex items-center justify-between gap-4 rounded-xl bg-raised px-4 py-3">
        <span className="label-caps text-muted">{messages.dashboard.balance}</span>
        <span className="amount font-display text-xl font-bold text-fg">{format.currency(balanceCents)}</span>
      </div>
      <h3 className="label-caps mt-5 text-muted">{text.stepsTitle}</h3>
      <ol className="mt-3 space-y-3">
        {text.steps.map((step, index) => (
          <li key={step} className="flex gap-3 text-sm text-fg">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-400/15 text-xs font-bold text-accent-400">
              {index + 1}
            </span>
            <span className="pt-0.5 leading-relaxed">{step}</span>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-xs leading-relaxed text-subtle">{text.terms(MINIMUM_TERM_DAYS, PAYOUT_DEADLINE_DAYS)}</p>
    </OneTimeDialog>
  );
}
