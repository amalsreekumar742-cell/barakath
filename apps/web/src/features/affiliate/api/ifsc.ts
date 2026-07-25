import { Constants } from '@/config/constants';

/**
 * Resolves an IFSC code to a bank + branch through Razorpay's free, public IFSC directory (spec §2.22
 * "IFSC (auto-verify)") — the exact same host `apps/app`'s `IfscRemoteDataSourceImpl` calls, here as a
 * plain browser `fetch` (confirmed live: the endpoint sends `Access-Control-Allow-Origin: *`, so no
 * server proxy/Cloud Function is needed for what is an unauthenticated third-party GET).
 *
 * 200 -> the bank details. 404 -> a validation-style error (invalid code). Any other failure (including
 * a network error) -> a distinct message, so "offline" is never confused with "bad code" the way the
 * brief requires.
 */
export interface IfscDetails {
  ifsc: string;
  bank: string;
  branch: string;
}

export async function verifyIfsc(ifsc: string): Promise<IfscDetails> {
  const code = ifsc.trim().toUpperCase();
  if (code.length !== 11) throw new Error('An IFSC code is 11 characters.');

  let response: Response;
  try {
    response = await fetch(`${Constants.IFSC_LOOKUP_BASE_URL}/${code}`);
  } catch {
    throw new Error('No internet connection — we could not verify the IFSC code.');
  }

  if (response.status === 404) {
    throw new Error("We couldn't find a bank for this IFSC code. Please check it.");
  }
  if (!response.ok) {
    throw new Error("We couldn't verify the IFSC code right now. Please try again.");
  }

  let data: Record<string, unknown>;
  try {
    data = await response.json();
  } catch {
    throw new Error("We couldn't read the bank details for this IFSC code.");
  }

  const bank = String(data?.BANK ?? '').trim();
  const branch = String(data?.BRANCH ?? '').trim();
  if (!bank) throw new Error("We couldn't find a bank for this IFSC code. Please check it.");

  // The directory echoes the code back under `IFSC`; fall back to what was typed if it ever doesn't.
  const echoedIfsc = String(data?.IFSC ?? '').trim();
  return { ifsc: echoedIfsc || code, bank, branch };
}
