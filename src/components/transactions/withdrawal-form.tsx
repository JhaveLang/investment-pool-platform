"use client";

import { useActionState, useState } from "react";
import { withdrawalAction } from "@/actions/transactions";
import { ActionStateAlert } from "@/components/ui/alert";
import { FormField } from "@/components/ui/form-field";
import { Icon } from "@/components/ui/icon";
import { SubmitButton } from "@/components/ui/submit-button";
import { useFormatter, useLocale, useMessages } from "@/i18n/client";
import { fieldErrorsOf, idleActionState, submittedValuesOf } from "@/lib/action-state";
import { FEE_PERCENT, maxWithdrawalPayoutCents, withdrawalFeeCents } from "@/lib/fees";
import { parseAmountToCents } from "@/lib/money";
import { PAYOUT_DEADLINE_DAYS } from "@/lib/returns";
import { AmountField } from "./amount-field";
import { Breakdown, ProjectedBalance } from "./breakdown";
import { initialPaymentMethod, PaymentMethodPicker } from "./payment-method-picker";

const QUICK_ADDS = [50_000, 100_000, 500_000];

type WithdrawalFormProps = {
  idempotencyKey: string;
  balanceCents: number;
  /** Balance minus capital in the minimum term; payout plus fee must fit into it. */
  availableCents: number;
};

export function WithdrawalForm({ idempotencyKey, balanceCents, availableCents }: WithdrawalFormProps) {
  const text = useMessages().withdrawals;
  const locale = useLocale();
  const format = useFormatter();
  const [state, formAction] = useActionState(withdrawalAction, idleActionState);
  const fieldErrors = fieldErrorsOf(state);
  const values = submittedValuesOf(state);
  const [method, setMethod] = useState(() => initialPaymentMethod(values.method));
  const [amountText, setAmountText] = useState(values.amount ?? "");

  const amountCents = parseAmountToCents(amountText, locale);
  const feeCents = amountCents === null ? 0 : withdrawalFeeCents(amountCents, method);
  const debitCents = amountCents === null ? 0 : amountCents + feeCents;
  const maxPayoutCents = maxWithdrawalPayoutCents(availableCents, method);

  return (
    <form action={formAction} onReset={() => setAmountText("")} noValidate className="flex flex-col gap-5">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <ActionStateAlert state={state} />
      <PaymentMethodPicker
        legend={text.method}
        value={method}
        onChange={setMethod}
        describe={(option) =>
          FEE_PERCENT[option] === 0 ? text.noFee : text.feeShare(format.percent(FEE_PERCENT[option]))
        }
        error={fieldErrors.method}
      />
      <AmountField
        label={text.amount}
        value={amountText}
        onChange={setAmountText}
        quickAdds={QUICK_ADDS}
        maxCents={maxPayoutCents}
        placeholder={text.amountPlaceholder}
        hint={text.maxPayout(format.currency(maxPayoutCents))}
        error={fieldErrors.amount ?? fieldErrors.idempotencyKey}
      />
      {method === "bank_transfer" ? (
        <FormField
          key="iban"
          name="iban"
          label={text.iban}
          autoComplete="off"
          spellCheck={false}
          placeholder={text.ibanPlaceholder}
          required
          defaultValue={values.iban}
          error={fieldErrors.iban}
        />
      ) : (
        <FormField
          key="walletAddress"
          name="walletAddress"
          label={method === "exchange" ? text.exchangeAddress : text.walletAddress}
          autoComplete="off"
          spellCheck={false}
          placeholder={text.walletAddressPlaceholder}
          required
          defaultValue={values.walletAddress}
          error={fieldErrors.walletAddress}
        />
      )}
      <Breakdown
        rows={[
          { label: text.feeLabel, value: feeCents > 0 ? format.currency(feeCents) : text.noFee },
          { label: text.debitLabel, value: format.currency(debitCents) },
          { label: text.payoutLabel, value: text.payoutValue(PAYOUT_DEADLINE_DAYS) },
        ]}
      />
      <ProjectedBalance label={text.newBalance} value={format.currency(Math.max(0, balanceCents - debitCents))} />
      <SubmitButton size="lg" className="h-14 w-full text-base" pendingLabel={text.pending}>
        <Icon name="lock" className="size-5" />
        {amountCents !== null ? text.submitAmount(format.currency(amountCents)) : text.submit}
      </SubmitButton>
      <p className="label-caps flex items-center justify-center gap-1.5 text-center text-subtle">
        <Icon name="shieldCheck" className="size-4" />
        {text.ledgerNote}
      </p>
      <p className="text-[13px] leading-relaxed text-subtle">{text.info}</p>
    </form>
  );
}
