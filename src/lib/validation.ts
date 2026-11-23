import { z } from "zod";
import type { Locale } from "@/i18n/config";
import { dictionaries } from "@/i18n/dictionaries";
import { isIsoMonth } from "@/lib/calendar";
import { PAYMENT_METHODS } from "@/lib/fees";
import { getFormatter } from "@/lib/format";
import { isValidIban, normalizeIban } from "@/lib/iban";
import { MAX_TRANSACTION_CENTS, MIN_TRANSACTION_CENTS, parseAmountToCents, parsePercentToPpm } from "@/lib/money";
import { MAX_RATE_PPM, MIN_RATE_PPM_EXCLUSIVE } from "@/lib/returns";

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

  // -------------------------------------------------------------------------
  // Form schemas
  // -------------------------------------------------------------------------

  return {
    loginSchema: z.object({
      email: emailSchema,
      password: z.string().min(1, { error: text.required }).max(128, { error: text.passwordTooLong }),
    }),

    registerSchema: z
      .object({
        fullName: fullNameSchema,
        email: emailSchema,
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

    depositSchema: z.object({
      amount: amountSchema,
      method: paymentMethodSchema,
      idempotencyKey: idempotencyKeySchema,
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
