import { z } from "zod";
import type { Locale } from "@/i18n/config";
import { dictionaries } from "@/i18n/dictionaries";
import { isIsoMonth } from "@/lib/calendar";
import { PAYMENT_METHODS } from "@/lib/fees";
import { getFormatter } from "@/lib/format";
import { isValidIban, normalizeIban } from "@/lib/iban";
import { INVESTOR_CODE_MAX_LENGTH, INVESTOR_CODE_MIN_LENGTH, INVESTOR_CODE_PATTERN } from "@/lib/investor-code";
import { MAX_NEWS_TEXT_LENGTH } from "@/lib/news";
import { MAX_PROMO_DETAILS_LENGTH } from "@/lib/promo";
import { MAX_TRANSACTION_CENTS, MIN_TRANSACTION_CENTS, parseAmountToCents, parsePercentToPpm } from "@/lib/money";
import {
  HIGHEST_WITHDRAWAL_MIN_CENTS,
  LOWEST_WITHDRAWAL_MAX_CENTS,
  MAX_POOL_NOTICE_LENGTH,
} from "@/lib/pool-settings";
import { MAX_RATE_PPM, MIN_RATE_PPM_EXCLUSIVE } from "@/lib/returns";

/** At most this many investor IDs are saved at once from the investor list (a page shows 20). */
export const MAX_INVESTOR_CODE_CHANGES = 50;

/** Wallet or exchange deposit addresses: 20–128 letters and digits, plus ":._-" for tags and URIs. */
const WALLET_ADDRESS_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:._-]{19,127}$/;

/** Builds every form schema with error messages and number notation for one locale. */
function createSchemas(locale: Locale) {
  const text = dictionaries[locale].validation;
  const format = getFormatter(locale);

  // -------------------------------------------------------------------------
  // Building blocks
  // -------------------------------------------------------------------------

  const emailSchema = z
    .string()
    .trim()
    .toLowerCase()
    .min(1, { error: text.required })
    .max(255, { error: text.invalidEmail })
    .pipe(z.email({ error: text.invalidEmail }));

  const newPasswordSchema = z
    .string()
    .min(10, { error: text.passwordTooShort })
    .max(128, { error: text.passwordTooLong });

  const fullNameSchema = z.string().trim().min(2, { error: text.nameTooShort }).max(120, { error: text.nameTooLong });

  /** Investor ID like 01GR01 or INV-0042; lower-case input is accepted and stored upper-case. */
  const investorCodeSchema = z
    .string()
    .trim()
    .toUpperCase()
    .min(1, { error: text.required })
    .min(INVESTOR_CODE_MIN_LENGTH, { error: text.investorCodeTooShort(INVESTOR_CODE_MIN_LENGTH) })
    .max(INVESTOR_CODE_MAX_LENGTH, { error: text.investorCodeTooLong(INVESTOR_CODE_MAX_LENGTH) })
    .regex(INVESTOR_CODE_PATTERN, { error: text.invalidInvestorCode });

  /** Left empty, a random investor ID is assigned. */
  const optionalInvestorCodeSchema = z
    .string()
    .trim()
    .transform((code) => code || undefined)
    .pipe(investorCodeSchema.optional());

  /** Accepts the locale's notation ("1.234,56" in German, "1,234.56" in English) and yields integer cents. */
  const amountSchema = z.string().transform((value, context) => {
    const amountCents = parseAmountToCents(value, locale);
    if (amountCents === null) {
      context.addIssue({ code: "custom", message: text.invalidAmount });
      return z.NEVER;
    }
    if (amountCents < MIN_TRANSACTION_CENTS) {
      context.addIssue({ code: "custom", message: text.amountTooSmall(format.currency(MIN_TRANSACTION_CENTS)) });
      return z.NEVER;
    }
    if (amountCents > MAX_TRANSACTION_CENTS) {
      context.addIssue({ code: "custom", message: text.amountTooLarge(format.currency(MAX_TRANSACTION_CENTS)) });
      return z.NEVER;
    }
    return amountCents;
  });

  const wholeEuroAmountSchema = amountSchema.refine((value) => value % 100 === 0, { error: text.promoWholeEuros });

  /** Promo percentages are kept to two decimals as integer basis points (2.00% -> 200). */
  const promoReturnSchema = z.string().transform((value, context) => {
    const basisPoints = parseAmountToCents(value, locale);
    if (basisPoints === null || basisPoints <= 0) {
      context.addIssue({ code: "custom", message: text.invalidRate });
      return z.NEVER;
    }
    if (basisPoints > 10_000) {
      context.addIssue({ code: "custom", message: text.promoReturnTooLarge });
      return z.NEVER;
    }
    return basisPoints;
  });

  const idempotencyKeySchema = z.uuid({ error: text.invalidRequest });

  const paymentMethodSchema = z.enum(PAYMENT_METHODS, { error: text.invalidPaymentMethod });

  const ibanSchema = z.string().transform(normalizeIban).refine(isValidIban, { error: text.invalidIban });

  const walletAddressSchema = z.string().trim().regex(WALLET_ADDRESS_PATTERN, { error: text.invalidWalletAddress });

  /** Monthly result in percent ("2,35", "-0,8") as parts per million, above −100 % and at most +100 %. */
  const rateSchema = z.string().transform((value, context) => {
    const ratePpm = parsePercentToPpm(value);
    if (ratePpm === null) {
      context.addIssue({ code: "custom", message: text.invalidRate });
      return z.NEVER;
    }
    if (ratePpm <= MIN_RATE_PPM_EXCLUSIVE || ratePpm > MAX_RATE_PPM) {
      context.addIssue({ code: "custom", message: text.rateOutOfRange });
      return z.NEVER;
    }
    return ratePpm;
  });

  const monthSchema = z.string().refine(isIsoMonth, { error: text.invalidMonth });

  const optionalNoteSchema = z
    .string()
    .trim()
    .max(500, { error: text.noteTooLong })
    .transform((note) => note || undefined);

  const optionalNoticeSchema = z
    .string()
    .trim()
    .max(MAX_POOL_NOTICE_LENGTH, { error: text.newsTextTooLong(MAX_POOL_NOTICE_LENGTH) })
    .transform((notice) => notice || null);

  // -------------------------------------------------------------------------
  // Form schemas
  // -------------------------------------------------------------------------

  return {
    loginSchema: z.object({
      email: emailSchema,
      password: z.string().min(1, { error: text.required }).max(128, { error: text.passwordTooLong }),
    }),

    /** An admin creates an investor with a starting password. */
    createInvestorSchema: z
      .object({
        fullName: fullNameSchema,
        email: emailSchema,
        investorCode: optionalInvestorCodeSchema,
        password: newPasswordSchema,
        passwordConfirmation: z.string(),
      })
      .refine((values) => values.password === values.passwordConfirmation, {
        error: text.passwordMismatch,
        path: ["passwordConfirmation"],
      }),

    changePasswordSchema: z
      .object({
        currentPassword: z.string().min(1, { error: text.required }).max(128, { error: text.passwordTooLong }),
        newPassword: newPasswordSchema,
        newPasswordConfirmation: z.string(),
      })
      .refine((values) => values.newPassword === values.newPasswordConfirmation, {
        error: text.passwordMismatch,
        path: ["newPasswordConfirmation"],
      })
      .refine((values) => values.newPassword !== values.currentPassword, {
        error: text.passwordUnchanged,
        path: ["newPassword"],
      }),

    adminUpdateInvestorSchema: z.object({
      userId: z.uuid({ error: text.invalidRequest }),
      fullName: fullNameSchema,
      email: emailSchema,
      investorCode: investorCodeSchema,
    }),

    /** Investor IDs edited in the investor list, saved together; the same new ID twice is marked on both rows. */
    adminInvestorCodesSchema: z
      .array(z.object({ userId: z.uuid({ error: text.invalidRequest }), investorCode: investorCodeSchema }))
      .min(1, { error: text.invalidRequest })
      .max(MAX_INVESTOR_CODE_CHANGES, { error: text.invalidRequest })
      .superRefine((changes, context) => {
        const codeCounts = new Map<string, number>();
        for (const { investorCode } of changes) {
          codeCounts.set(investorCode, (codeCounts.get(investorCode) ?? 0) + 1);
        }
        changes.forEach(({ investorCode }, index) => {
          if (codeCounts.get(investorCode)! > 1) {
            context.addIssue({ code: "custom", message: text.investorCodeTwice, path: [index, "investorCode"] });
          }
        });
      }),

    adminSetPasswordSchema: z
      .object({
        userId: z.uuid({ error: text.invalidRequest }),
        newPassword: newPasswordSchema,
        newPasswordConfirmation: z.string(),
      })
      .refine((values) => values.newPassword === values.newPasswordConfirmation, {
        error: text.passwordMismatch,
        path: ["newPasswordConfirmation"],
      }),

    /** Deactivating or activating an investor (`status` is the new status), with an optional note for the log. */
    adminInvestorStatusSchema: z.object({
      userId: z.uuid({ error: text.invalidRequest }),
      status: z.enum(["active", "deactivated"], { error: text.invalidRequest }),
      note: optionalNoteSchema,
    }),

    /** A notice for the public News page, written in German; DeepL translates it to English when it is saved. */
    newsEntrySchema: z.object({
      publishedOn: z.iso.date({ error: text.invalidDate }),
      textDe: z
        .string()
        .trim()
        .min(1, { error: text.required })
        .max(MAX_NEWS_TEXT_LENGTH, { error: text.newsTextTooLong(MAX_NEWS_TEXT_LENGTH) }),
      visible: z.boolean(),
    }),

    newsIdSchema: z.uuid({ error: text.invalidRequest }),

    promoIdSchema: z.uuid({ error: text.invalidRequest }),
    promoBookingSchema: z.object({
      promoId: z.uuid({ error: text.invalidRequest }),
      amount: wholeEuroAmountSchema,
      idempotencyKey: idempotencyKeySchema,
    }).transform(({ promoId, amount, idempotencyKey }) => ({ promoId, amountCents: amount, idempotencyKey })),

    promoOfferSchema: z
      .object({
        name: z.string().trim().min(1, { error: text.required }).max(100, { error: text.promoNameTooLong(100) }),
        bookingUntil: z.iso.date({ error: text.invalidDate }),
        minDeposit: wholeEuroAmountSchema,
        maxDeposit: wholeEuroAmountSchema,
        termMonths: z.string().regex(/^\d+$/, { error: text.invalidRequest }).transform(Number).pipe(z.number().int().min(1, { error: text.invalidRequest }).max(120, { error: text.invalidRequest })),
        totalReturn: promoReturnSchema,
        details: z.string().trim().max(MAX_PROMO_DETAILS_LENGTH, { error: text.promoDetailsTooLong(MAX_PROMO_DETAILS_LENGTH) }),
        isExample: z.boolean(),
        visible: z.boolean(),
      })
      .refine((values) => values.minDeposit <= values.maxDeposit, {
        error: text.maximumBelowMinimum,
        path: ["maxDeposit"],
      })
      .transform(({ minDeposit, maxDeposit, totalReturn, ...rest }) => ({
        ...rest,
        minDepositCents: minDeposit,
        maxDepositCents: maxDeposit,
        totalReturnBps: totalReturn,
      })),

    /** The pool page; withdrawals can't be blocked through their limits (see `src/lib/pool-settings.ts`). */
    poolSettingsSchema: z
      .object({
        depositsOpen: z.boolean(),
        depositMin: amountSchema,
        depositMax: amountSchema,
        withdrawalMin: amountSchema.refine((amountCents) => amountCents <= HIGHEST_WITHDRAWAL_MIN_CENTS, {
          error: text.withdrawalMinTooHigh(format.currency(HIGHEST_WITHDRAWAL_MIN_CENTS)),
        }),
        withdrawalMax: amountSchema.refine((amountCents) => amountCents >= LOWEST_WITHDRAWAL_MAX_CENTS, {
          error: text.withdrawalMaxTooLow(format.currency(LOWEST_WITHDRAWAL_MAX_CENTS)),
        }),
        noticeDe: optionalNoticeSchema,
        noticeEn: optionalNoticeSchema,
      })
      .refine((values) => values.depositMin <= values.depositMax, {
        error: text.maximumBelowMinimum,
        path: ["depositMax"],
      })
      .transform(({ depositMin, depositMax, withdrawalMin, withdrawalMax, ...rest }) => ({
        ...rest,
        depositMinCents: depositMin,
        depositMaxCents: depositMax,
        withdrawalMinCents: withdrawalMin,
        withdrawalMaxCents: withdrawalMax,
      })),

    depositSchema: z.object({
      amount: amountSchema,
      method: paymentMethodSchema,
      idempotencyKey: idempotencyKeySchema,
      promoOfferId: z.string().optional().transform((value) => value || undefined).pipe(z.uuid().optional()),
    }),

    /** Bank payouts need an IBAN, crypto and exchange payouts a wallet address. */
    withdrawalSchema: z.discriminatedUnion(
      "method",
      [
        z.object({
          method: z.literal("bank_transfer"),
          amount: amountSchema,
          iban: ibanSchema,
          idempotencyKey: idempotencyKeySchema,
        }),
        z.object({
          method: z.literal(["crypto", "exchange"]),
          amount: amountSchema,
          walletAddress: walletAddressSchema,
          idempotencyKey: idempotencyKeySchema,
        }),
      ],
      { error: text.invalidPaymentMethod },
    ),

    reviewSchema: z.object({
      recordId: z.uuid({ error: text.invalidRequest }),
      note: optionalNoteSchema,
    }),

    reconcileSchema: z.object({
      recordId: z.uuid({ error: text.invalidRequest }),
      note: optionalNoteSchema,
      receivedOn: z.iso.date({ error: text.invalidDate }),
    }),

    returnPreviewSchema: z.object({
      month: monthSchema,
      rate: rateSchema,
    }),

    bookReturnSchema: z.object({
      month: monthSchema,
      rate: rateSchema,
      expectedTotalCents: z.coerce.number({ error: text.invalidRequest }).int({ error: text.invalidRequest }),
    }),

    reportRangeSchema: z.object({
      from: z.iso.date().optional(),
      to: z.iso.date().optional(),
    }),
  };
}

export type ValidationSchemas = ReturnType<typeof createSchemas>;

const schemaCache = new Map<Locale, ValidationSchemas>();

/** Schemas are built once per locale and reused. */
export function getSchemas(locale: Locale): ValidationSchemas {
  let schemas = schemaCache.get(locale);
  if (!schemas) {
    schemas = createSchemas(locale);
    schemaCache.set(locale, schemas);
  }
  return schemas;
}
