"use client";

import { useActionState, useState } from "react";
import { depositAction } from "@/actions/transactions";
import { ActionStateAlert } from "@/components/ui/alert";
import { Icon } from "@/components/ui/icon";
import { SubmitButton } from "@/components/ui/submit-button";
import { useFormatter, useLocale, useMessages } from "@/i18n/client";
import { fieldErrorsOf, idleActionState, submittedValuesOf } from "@/lib/action-state";
import { depositFeeCents, FEE_PERCENT } from "@/lib/fees";
import { parseAmountToCents } from "@/lib/money";
import type { AmountLimits } from "@/lib/pool-settings";
import type { PromoOffer } from "@/server/db/schema";
import { ACCRUAL_DELAY_DAYS, MINIMUM_TERM_DAYS } from "@/lib/returns";
import { AmountField } from "./amount-field";
import { Breakdown, ProjectedBalance } from "./breakdown";
import { initialPaymentMethod, PaymentMethodPicker } from "./payment-method-picker";

const QUICK_ADDS = [100_000, 500_000, 1_000_000];

type DepositFormProps = {
  /** Generated per page render, so a double submit books only once. */
  idempotencyKey: string;
  balanceCents: number;
  limits: AmountLimits;
  promos: Pick<PromoOffer, "id" | "name" | "bookingUntil" | "minDepositCents" | "maxDepositCents" | "termMonths" | "totalReturnBps">[];
};

export function DepositForm({ idempotencyKey, balanceCents, limits, promos }: DepositFormProps) {
  const text = useMessages().deposits;
  const locale = useLocale();
  const format = useFormatter();
  const [state, formAction] = useActionState(depositAction, idleActionState);
  const fieldErrors = fieldErrorsOf(state);
  const values = submittedValuesOf(state);
  const [method, setMethod] = useState(() => initialPaymentMethod(values.method));
  const [amountText, setAmountText] = useState(values.amount ?? "");
  const [promoOfferId, setPromoOfferId] = useState(values.promoOfferId ?? "");
  const selectedPromo = promos.find((promo) => promo.id === promoOfferId);
  const currentLimits = selectedPromo
    ? { minCents: selectedPromo.minDepositCents, maxCents: selectedPromo.maxDepositCents }
    : limits;

  const amountCents = parseAmountToCents(amountText, locale);
  const feeCents = amountCents === null ? 0 : depositFeeCents(amountCents, method);
  const creditedCents = amountCents === null ? 0 : amountCents - feeCents;

  return (
    <form action={formAction} onReset={() => setAmountText("")} noValidate className="flex flex-col gap-5">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <ActionStateAlert state={state} />
      {promos.length > 0 ? (
        <label className="block space-y-1.5 text-sm font-medium text-fg">
          <span>{text.promoChoice}</span>
          <select name="promoOfferId" value={promoOfferId} onChange={(event) => setPromoOfferId(event.target.value)} className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-fg focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-400/30">
            <option value="">{text.standardDeposit}</option>
            {promos.map((promo) => <option key={promo.id} value={promo.id}>{promo.name} · {format.rate(promo.totalReturnBps * 100)} / {promo.termMonths} {text.months}</option>)}
          </select>
        </label>
      ) : <input type="hidden" name="promoOfferId" value="" />}
      {selectedPromo ? <p className="rounded-lg bg-well px-3.5 py-2.5 text-[13px] leading-relaxed text-muted">{text.promoTerms(format.currency(selectedPromo.minDepositCents), format.currency(selectedPromo.maxDepositCents), selectedPromo.termMonths, format.rate(selectedPromo.totalReturnBps * 100), format.calendarDate(selectedPromo.bookingUntil))}</p> : null}
      <PaymentMethodPicker
        legend={text.method}
        value={method}
        onChange={setMethod}
        describe={(option) => text.creditShare(format.percent(100 - FEE_PERCENT[option]))}
        error={fieldErrors.method}
      />
      <AmountField
        label={text.amount}
        value={amountText}
        onChange={setAmountText}
        limits={currentLimits}
        quickAdds={QUICK_ADDS}
        placeholder={text.amountPlaceholder}
        error={fieldErrors.amount ?? fieldErrors.idempotencyKey}
      />
      <Breakdown
        rows={[
          {
            label: text.feeLabel,
            value: feeCents > 0 ? format.currency(feeCents) : text.noFee,
          },
          { label: text.creditedLabel, value: format.currency(creditedCents), emphasis: creditedCents > 0 },
          selectedPromo
            ? { label: text.accrualLabel, value: text.promoMaturityReturn(format.rate(selectedPromo.totalReturnBps * 100)) }
            : { label: text.accrualLabel, value: text.accrualValue(ACCRUAL_DELAY_DAYS) },
          selectedPromo
            ? { label: text.termLabel, value: text.promoTermValue(selectedPromo.termMonths) }
            : { label: text.termLabel, value: text.termValue(MINIMUM_TERM_DAYS) },
        ]}
      />
      <ProjectedBalance label={text.newBalance} value={format.currency(balanceCents + creditedCents)} />
      <SubmitButton size="lg" className="h-14 w-full text-base" pendingLabel={text.pending}>
        <Icon name="lock" className="size-5" />
        {amountCents !== null ? text.submitAmount(format.currency(amountCents)) : text.submit}
      </SubmitButton>
      <p className="label-caps flex items-center justify-center gap-1.5 text-center text-subtle">
        <Icon name="shieldCheck" className="size-4" />
        {text.ledgerNote}
      </p>
      <p className="text-[13px] leading-relaxed text-subtle">{selectedPromo ? text.promoDepositInfo : text.info}</p>
    </form>
  );
}
