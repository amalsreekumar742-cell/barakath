import { describe, it, expect } from 'vitest';
import { OrderStatus } from '@barakath/shared/config/enums';
import { bulkActionLabel, isBulkActionable, isBulkSelectable } from './orderFlow';

describe('bulkActionLabel', () => {
  it('labels every advanceable status in the plural', () => {
    expect(bulkActionLabel(OrderStatus.PENDING)).toBe('Accept orders');
    expect(bulkActionLabel(OrderStatus.ACCEPTED)).toBe('Mark as packed');
    expect(bulkActionLabel(OrderStatus.PACKED)).toBe('Mark as shipped');
    expect(bulkActionLabel(OrderStatus.SHIPPED)).toBe('Out for delivery');
    expect(bulkActionLabel(OrderStatus.OUT_FOR_DELIVERY)).toBe('Mark as delivered');
  });

  it('has no advance for terminal statuses', () => {
    expect(bulkActionLabel(OrderStatus.DELIVERED)).toBeNull();
    expect(bulkActionLabel(OrderStatus.CANCELLED)).toBeNull();
  });
});

describe('isBulkActionable', () => {
  it('is false only for terminal statuses', () => {
    expect(isBulkActionable(OrderStatus.PENDING)).toBe(true);
    expect(isBulkActionable(OrderStatus.OUT_FOR_DELIVERY)).toBe(true);
    expect(isBulkActionable(OrderStatus.DELIVERED)).toBe(false);
    expect(isBulkActionable(OrderStatus.CANCELLED)).toBe(false);
  });
});

describe('isBulkSelectable', () => {
  it('allows any actionable order when nothing is selected yet', () => {
    expect(isBulkSelectable(OrderStatus.PACKED, null)).toBe(true);
    expect(isBulkSelectable(OrderStatus.DELIVERED, null)).toBe(false);
  });

  it('locks the selection to the first selected status', () => {
    expect(isBulkSelectable(OrderStatus.PENDING, OrderStatus.PENDING)).toBe(true);
    expect(isBulkSelectable(OrderStatus.ACCEPTED, OrderStatus.PENDING)).toBe(false);
  });
});
