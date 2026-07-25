import { z } from 'zod';

/**
 * The delivery-address form schema — field names and validation rules mirror
 * `apps/app/lib/features/address/presentation/pages/add_address_page.dart` exactly (read per this
 * batch's step 0), so the website writes `users/{uid}/addresses/{id}` documents identical in shape to
 * what the Flutter app writes. `packages/shared`'s `UserAddressProps` is the wire type; this is the
 * FORM's shape (phone without the `+91` prefix, split out for the input's own digit-only field —
 * `features/address/api/addresses.ts` re-assembles the stored `"+91 XXXXXXXXXX"` string).
 */
export const ADDRESS_LABELS = ['Home', 'Office', 'Other'] as const;

export const addressFormSchema = z.object({
  label: z.enum(ADDRESS_LABELS),
  fullName: z.string().trim().min(2, "Enter the recipient's name"),
  /** India-only, digits after the fixed +91 prefix — matches the website's OTP flow (no country picker). */
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a 10-digit mobile number'),
  addressLine1: z.string().trim().min(5, 'Enter the street address'),
  addressLine2: z.string().trim().optional().default(''),
  city: z.string().trim().min(1, 'Enter your city'),
  state: z.string().trim().min(1, 'Select your state'),
  pincode: z.string().trim().regex(/^\d{6}$/, 'Enter a 6-digit pincode'),
  landmark: z.string().trim().optional().default(''),
  /**
   * A manual "set as default" toggle — present in the shipped Flutter form
   * (`add_address_page.dart`'s `SwitchListTile`) even though spec §2.14's own text only describes
   * "first added = default, no toggle". Real code wins per this batch's instructions: the form keeps
   * the toggle, and `createAddress` still forces the FIRST address to default regardless of this value.
   */
  isDefault: z.boolean().optional().default(false),
});

export type AddressFormValues = z.infer<typeof addressFormSchema>;
