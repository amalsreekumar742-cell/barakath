import { z } from 'zod';

/**
 * Add-bank-account form schema (spec §2.22): holder name, account number entered twice (must match),
 * and an 11-character IFSC. Field names/validation mirror
 * `apps/app/lib/features/affiliate/presentation/pages/add_bank_account_page.dart` — the account-number
 * length floor (6) and the confirm-match rule are taken straight from that screen's own validators.
 *
 * WHY the IFSC field only checks shape (length 11) here, not that it resolved to a real bank: the
 * Razorpay lookup is an async network call this synchronous schema cannot perform. The form component
 * separately tracks `verifiedIfsc` (the last code that successfully resolved) and blocks submit until
 * it matches the typed value — same two-layer split Flutter's `_validateIfsc` uses (schema shape here,
 * "has this exact code been verified" as imperative state in the component).
 */
export const bankAccountFormSchema = z
  .object({
    accountHolderName: z.string().trim().min(2, 'Enter the account holder name.'),
    accountNumber: z
      .string()
      .trim()
      .min(6, 'That account number looks too short.')
      .regex(/^\d+$/, 'Digits only.'),
    confirmAccountNumber: z.string().trim().min(1, 'Re-enter the account number.'),
    ifscCode: z
      .string()
      .trim()
      .toUpperCase()
      .length(11, 'An IFSC code is 11 characters.')
      .regex(/^[A-Z0-9]+$/, 'Letters and digits only.'),
  })
  .superRefine((values, ctx) => {
    if (values.accountNumber !== values.confirmAccountNumber) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'The account numbers do not match.',
        path: ['confirmAccountNumber'],
      });
    }
  });

export type BankAccountFormValues = z.infer<typeof bankAccountFormSchema>;
