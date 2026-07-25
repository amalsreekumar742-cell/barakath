import { z } from 'zod';
import { Constants } from '@/config/constants';

/**
 * Zod schemas for the three login steps. Kept in one file so the field rules (and the messages a
 * customer sees) live next to each other rather than being reinvented per step component.
 *
 * WHY validate the phone/OTP shape client-side when the server validates too: it turns an obvious
 * typo (9 digits, a letter) into instant inline feedback instead of a round-trip that spends an SMS
 * allowance. The server remains the authority — "identity comes from the verified phone" — this is
 * only a fast, cheap first gate.
 */

/** Indian mobile: exactly 10 digits, first digit 6–9 (the server rejects anything else anyway). */
const indianMobile = z
  .string()
  .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number.');

export const phoneSchema = z.object({
  phone: indianMobile,
});
export type PhoneForm = z.infer<typeof phoneSchema>;

export const otpSchema = z.object({
  otp: z
    .string()
    .regex(new RegExp(`^\\d{${Constants.OTP_LENGTH}}$`), `Enter the ${Constants.OTP_LENGTH}-digit code.`),
});
export type OtpForm = z.infer<typeof otpSchema>;

/**
 * Profile step: only `fullName` is required. Optional fields validate their shape but accept empty.
 * WHY email/whatsapp are optional-yet-validated: the design marks them optional, but a malformed one
 * that reaches the doc is worse than a missing one — so an entered value must still be well-formed.
 */
export const profileSchema = z.object({
  fullName: z.string().trim().min(1, 'Please enter your name.'),
  email: z
    .string()
    .trim()
    .email('Enter a valid email address.')
    .or(z.literal(''))
    .optional(),
  whatsapp: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit number.')
    .or(z.literal(''))
    .optional(),
  referredBy: z.string().trim().optional(),
});
export type ProfileForm = z.infer<typeof profileSchema>;
