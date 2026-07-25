import { describe, expect, it } from 'vitest';
import { computeTotals, type TotalsSettings } from './totals';
import type { CartItem, AppliedCoupon } from '@/types/cart';

/**
 * Unit tests for the display-only totals engine (see totals.ts's header comment for why this exists
 * and what it must NOT diverge from). Covers the five cases the C0 brief called out by name: the
 * free-shipping threshold, a percentage coupon's cap, the combo-fee-replaces-and-largest-wins rule,
 * wallet exceeding the amount due, and a coupon discount capped at the subtotal.
 *
 * No live order was available in this environment to cross-check against (no Firestore access from
 * this session) — the assertions instead re-derive the expected figures by hand from the same
 * formulas `computeOrderTotals`/`computeCouponDiscount` use server-side, which is what this file is
 * ported from line-for-line. Flagged per the brief rather than silently skipped.
 */

function item(overrides: Partial<CartItem> = {}): CartItem {
  return {
    productId: 'p1',
    variantId: 'v1',
    categoryId: 'cat-perfume',
    name: 'Royal Oud',
    image: '',
    variantDetails: '50ml',
    unitPrice: 500,
    mrp: 600,
    quantity: 1,
    isCombo: false,
    comboDeliveryCharge: 0,
    stockAtAdd: 10,
    ...overrides,
  };
}

const settings: TotalsSettings = {
  delivery: { standardDeliveryFee: 60, freeDeliveryThreshold: 1000, gstPercentage: 5, gstin: '', pricesIncludeTax: false },
  payment: { razorpayKeyId: '', razorpayKeySecret: '', razorpayConnected: true, walletPaymentsEnabled: true },
};

describe('computeTotals — delivery', () => {
  it('charges the standard fee below the free-delivery threshold', () => {
    const items = [item({ unitPrice: 400, quantity: 1 })]; // subtotal 400 < threshold 1000
    const t = computeTotals({ items, coupon: null, walletBalance: 0, walletApplied: false, generalSettings: settings });
    expect(t.subtotal).toBe(400);
    expect(t.deliveryCharge).toBe(60);
  });

  it('waives delivery once the subtotal clears the free-delivery threshold', () => {
    const items = [item({ unitPrice: 1000, quantity: 1 })]; // subtotal 1000 === threshold
    const t = computeTotals({ items, coupon: null, walletBalance: 0, walletApplied: false, generalSettings: settings });
    expect(t.deliveryCharge).toBe(0);
  });

  it('combo delivery REPLACES the standard fee and the LARGEST combo charge wins', () => {
    const items = [
      item({ productId: 'p1', unitPrice: 200, isCombo: true, comboDeliveryCharge: 40 }),
      item({ productId: 'p2', variantId: 'v2', unitPrice: 200, isCombo: true, comboDeliveryCharge: 90 }),
      item({ productId: 'p3', variantId: 'v3', unitPrice: 700 }), // non-combo line, subtotal now 1100 (clears threshold)
    ];
    const t = computeTotals({ items, coupon: null, walletBalance: 0, walletApplied: false, generalSettings: settings });
    // Even though the subtotal (1100) clears the free-delivery threshold, a combo charge is present,
    // so the free-delivery waiver never applies — the largest combo charge (90) is what's charged,
    // not 0 and not the sum of both combo charges (40 + 90 = 130).
    expect(t.deliveryCharge).toBe(90);
  });
});

describe('computeTotals — coupon', () => {
  it('caps a percentage discount at maximumDiscount', () => {
    const items = [item({ unitPrice: 2000, quantity: 1 })]; // subtotal 2000
    const coupon: AppliedCoupon = {
      code: 'SAVE20', description: '', discountType: 'Percentage', discountValue: 20, maximumDiscount: 150,
      applicationType: 'All', applicableCategories: [], applicableProducts: [], isSpinWon: false,
    };
    // 20% of 2000 = 400, but maximumDiscount caps it at 150.
    const t = computeTotals({ items, coupon, walletBalance: 0, walletApplied: false, generalSettings: settings });
    expect(t.couponDiscount).toBe(150);
  });

  it('caps a fixed discount at the subtotal — never a negative pre-tax amount', () => {
    const items = [item({ unitPrice: 100, quantity: 1 })]; // subtotal 100
    const coupon: AppliedCoupon = {
      code: 'FLAT500', description: '', discountType: 'Fixed', discountValue: 500, maximumDiscount: 0,
      applicationType: 'All', applicableCategories: [], applicableProducts: [], isSpinWon: false,
    };
    const t = computeTotals({ items, coupon, walletBalance: 0, walletApplied: false, generalSettings: settings });
    expect(t.couponDiscount).toBe(100); // clamped to subtotal, not 500
    expect(t.subtotal - t.couponDiscount).toBe(0);
  });
});

describe('computeTotals — wallet', () => {
  it('clamps wallet spend to the grand total and never pushes razorpayAmount negative', () => {
    const items = [item({ unitPrice: 300, quantity: 1 })]; // subtotal 300, below threshold -> +60 delivery, +5% gst
    const t = computeTotals({ items, coupon: null, walletBalance: 100000, walletApplied: true, generalSettings: settings });
    expect(t.walletAmountUsed).toBe(t.grandTotal);
    expect(t.razorpayAmount).toBe(0);
  });

  it('spends nothing from the wallet when the toggle is off, even with a healthy balance', () => {
    const items = [item({ unitPrice: 300, quantity: 1 })];
    const t = computeTotals({ items, coupon: null, walletBalance: 5000, walletApplied: false, generalSettings: settings });
    expect(t.walletAmountUsed).toBe(0);
    expect(t.razorpayAmount).toBe(t.grandTotal);
  });

  it('spends nothing when wallet payments are disabled in settings, even with the toggle on', () => {
    const disabledWallet: TotalsSettings = { ...settings, payment: { ...settings.payment, walletPaymentsEnabled: false } };
    const items = [item({ unitPrice: 300, quantity: 1 })];
    const t = computeTotals({ items, coupon: null, walletBalance: 5000, walletApplied: true, generalSettings: disabledWallet });
    expect(t.walletAmountUsed).toBe(0);
  });
});

describe('computeTotals — GST and grand total order of operations', () => {
  it('computes GST on (subtotal - discount), then adds delivery on top, matching computeOrderTotals', () => {
    const items = [item({ unitPrice: 1200, quantity: 1 })]; // subtotal 1200, clears threshold -> delivery 0
    const coupon: AppliedCoupon = {
      code: 'TENOFF', description: '', discountType: 'Fixed', discountValue: 200, maximumDiscount: 0,
      applicationType: 'All', applicableCategories: [], applicableProducts: [], isSpinWon: false,
    };
    const t = computeTotals({ items, coupon, walletBalance: 0, walletApplied: false, generalSettings: settings });
    expect(t.subtotal).toBe(1200);
    expect(t.couponDiscount).toBe(200);
    expect(t.deliveryCharge).toBe(0);
    // gst = (1200 - 200) * 5% = 50
    expect(t.gstAmount).toBe(50);
    // grandTotal = 1200 - 200 + 0 + 50 = 1050
    expect(t.grandTotal).toBe(1050);
    expect(t.razorpayAmount).toBe(1050);
  });
});

describe('computeTotals — Category/Product coupon eligibility', () => {
  it('gives no discount preview when a Category coupon matches nothing in the cart', () => {
    const items = [item({ categoryId: 'cat-books' })];
    const coupon: AppliedCoupon = {
      code: 'PERFUME10', description: '', discountType: 'Percentage', discountValue: 10, maximumDiscount: 0,
      applicationType: 'Category', applicableCategories: ['cat-perfume'], applicableProducts: [], isSpinWon: false,
    };
    const t = computeTotals({ items, coupon, walletBalance: 0, walletApplied: false, generalSettings: settings });
    expect(t.couponDiscount).toBe(0);
  });

  it('discounts only the matching lines for a Category coupon, not the whole subtotal', () => {
    const items = [
      item({ productId: 'p1', categoryId: 'cat-perfume', unitPrice: 500 }),
      item({ productId: 'p2', variantId: 'v2', categoryId: 'cat-books', unitPrice: 500 }),
    ];
    const coupon: AppliedCoupon = {
      code: 'PERFUME10', description: '', discountType: 'Percentage', discountValue: 10, maximumDiscount: 0,
      applicationType: 'Category', applicableCategories: ['cat-perfume'], applicableProducts: [], isSpinWon: false,
    };
    const t = computeTotals({ items, coupon, walletBalance: 0, walletApplied: false, generalSettings: settings });
    // 10% of the perfume line only (500), not the full 1000 subtotal.
    expect(t.couponDiscount).toBe(50);
  });
});
