/**
 * randomCode — generate an N-character uppercase alphanumeric token from a safe alphabet.
 *
 * WHY a shared helper: spin-reward coupon codes ("SPIN-XXXXXX") and affiliate referral codes
 *   ("BARXXXXXX") both need short, human-typable random tokens. Centralizing the alphabet + length
 *   logic here stops the two call sites drifting into different formats.
 * WHY this alphabet: it omits the visually ambiguous 0/O/1/I so a customer reading a code off the
 *   screen (or an admin off a support ticket) can't mistype it.
 */
export function randomCode(length: number): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < length; i++) {
    // charAt (not []) always returns a string, satisfying noUncheckedIndexedAccess without a guard.
    out += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return out;
}
