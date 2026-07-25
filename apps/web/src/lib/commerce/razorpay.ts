'use client';

/**
 * Razorpay Checkout loader — the website uses Razorpay's hosted Checkout script (`checkout.js`), NOT
 * the Flutter `razorpay_flutter` SDK the app uses. There is no official npm package for this (the
 * `razorpay` package on npm is the SERVER-side Orders/Payments API client, used by `functions/`, and
 * must never ship to the browser — it would need the key secret). The browser integration is
 * genuinely just "load this script tag, then call `new window.Razorpay(options)`", per Razorpay's own
 * docs, so that's what this file does — no dependency to add.
 *
 * Never hardcode the key: `keyId` always comes back from `createPaymentOrder`'s `key_id` field
 * (`functions/src/orders/createPaymentOrder.ts` reads it from `general/config`/`general/secrets`
 * server-side), never from an env var baked into this file.
 */

const CHECKOUT_SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

export interface RazorpaySuccessResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description?: string;
  prefill?: { name?: string; contact?: string; email?: string };
  theme?: { color?: string };
  handler: (response: RazorpaySuccessResponse) => void;
  modal?: { ondismiss?: () => void };
}

interface RazorpayInstance {
  open(): void;
  on(event: 'payment.failed', handler: (response: { error: { description?: string } }) => void): void;
  close?(): void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

let loadingPromise: Promise<void> | null = null;

/**
 * Idempotent, promise-based `checkout.js` loader — resolves once `window.Razorpay` exists. Safe to
 * call from multiple places (e.g. both a "preload on cart page" hint and the actual Pay click);
 * concurrent callers share one in-flight script tag rather than injecting it twice.
 *
 * Rejects with a customer-readable message when the script fails to load (an ad blocker is the most
 * common real-world cause) — callers must catch this and show it rather than letting the Pay button
 * hang silently.
 */
export function loadRazorpayScript(): Promise<void> {
  if (typeof window !== 'undefined' && window.Razorpay) return Promise.resolve();
  if (loadingPromise) return loadingPromise;

  loadingPromise = new Promise<void>((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('Razorpay Checkout can only load in the browser.'));
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(scriptLoadError()));
      // The script may have already finished loading between a previous call and this one.
      if (window.Razorpay) resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = CHECKOUT_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loadingPromise = null; // let a later retry try again instead of staying rejected forever
      reject(scriptLoadError());
    };
    document.body.appendChild(script);
  });

  return loadingPromise;
}

function scriptLoadError(): Error {
  return new Error(
    'Could not load the payment gateway. Check your connection or disable any ad blocker, then try again.',
  );
}

export interface OpenCheckoutParams {
  razorpayOrderId: string;
  keyId: string;
  /** Rupees — converted to paisa here so every caller works in the same unit the rest of the app uses. */
  amount: number;
  description?: string;
  prefill?: { name?: string; contact?: string; email?: string };
  onSuccess: (response: RazorpaySuccessResponse) => void;
  onDismiss: () => void;
  onFailure?: (error: { description?: string }) => void;
}

/**
 * Load the script (if needed) and open the Checkout sheet. `onSuccess` fires with the three fields
 * `verifyPayment` needs; `onDismiss` fires when the customer closes the sheet without completing
 * payment (never attempted — no webhook will ever fire for this); `onFailure` fires on an explicit
 * in-sheet failure. Exactly one of the three ever fires per `openCheckout` call.
 */
export async function openCheckout(params: OpenCheckoutParams): Promise<void> {
  await loadRazorpayScript();
  if (typeof window === 'undefined' || !window.Razorpay) {
    throw new Error('Payment gateway unavailable.');
  }
  const instance = new window.Razorpay({
    key: params.keyId,
    amount: Math.round(params.amount * 100),
    currency: 'INR',
    order_id: params.razorpayOrderId,
    name: 'Barakath',
    description: params.description,
    prefill: params.prefill,
    theme: { color: '#0f7a5a' }, // --color-primary
    handler: (response) => params.onSuccess(response),
    modal: { ondismiss: () => params.onDismiss() },
  });
  instance.on('payment.failed', (response) => params.onFailure?.(response.error));
  instance.open();
}
