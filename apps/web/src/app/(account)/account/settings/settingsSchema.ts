import { z } from 'zod';

/**
 * Personal-info form (spec 3.19): Full name, WhatsApp, Email are editable; Mobile is display-only (it
 * is the login identity — see `PersonalInfoForm`). Mirrors `features/auth/types/schemas.ts`'s
 * `profileSchema` field-for-field (same optional-yet-validated shape) so a customer sees the identical
 * validation rules at signup and in settings.
 */
export const personalInfoSchema = z.object({
  fullName: z.string().trim().min(1, 'Please enter your name.'),
  whatsapp: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit number.')
    .or(z.literal(''))
    .optional(),
  email: z
    .string()
    .trim()
    .email('Enter a valid email address.')
    .or(z.literal(''))
    .optional(),
});

export type PersonalInfoFormValues = z.infer<typeof personalInfoSchema>;
