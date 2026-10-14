import { sumStock } from './stock';

/** The slice of a saved variant the stock plan needs. */
export interface StockPlanVariant {
  id: string;
  isNew: boolean;
  stock: number;
  originalStock?: number;
}

/** One existing variant whose stock the admin changed in the form. */
export interface StockChange {
  variantId: string;
  /** The LIVE stock read at save time — what the audit trail records as "before". */
  previousStock: number;
  newStock: number;
}

export interface VariantStockPlan {
  /** variantId → stock to write. Variants absent here must NOT have `stock` in their write. */
  writeStock: Map<string, number>;
  /** Existing variants whose stock changed — each also gets a `stockAdjustments` audit doc. */
  changes: StockChange[];
  /** What the product's `totalStock` will really be once the batch commits. */
  totalStock: number;
}

/**
 * planVariantStock — decide which variant stocks a product save may write.
 *
 * WHY not just write the form's stock: the form holds the stock as it was when the page OPENED. Every
 * order decrements variant stock in the meantime, so writing the form's copy back silently undid any
 * sale made while the admin was editing — and `totalStock` summed from that copy drifted with it. So an
 * existing variant's stock is written only when the admin actually changed it (draft ≠ `originalStock`);
 * otherwise the write omits `stock` and the total uses the LIVE value from the save-time read.
 *
 * A changed stock is an absolute set (same as Inventory › Adjust stock), audited against the live
 * value: if an order took 10 → 9 and the admin typed 15, the record says 9 → 15 (+6), which is what
 * actually happened to the shelf count. A change that lands exactly on the live value is skipped —
 * there is nothing to write and a +0 audit row is noise.
 *
 * New variants always write their stock. An existing variant without `originalStock` (no form path
 * produces one today) is treated as "the draft is what the admin wants" and diffed against live.
 */
export function planVariantStock(
  variants: StockPlanVariant[],
  liveStock: Map<string, number>,
): VariantStockPlan {
  const writeStock = new Map<string, number>();
  const changes: StockChange[] = [];
  const finalStocks: number[] = [];

  for (const v of variants) {
    if (v.isNew) {
      writeStock.set(v.id, v.stock);
      finalStocks.push(v.stock);
      continue;
    }
    const live = liveStock.get(v.id);
    const before = live ?? v.originalStock ?? v.stock;
    const edited = v.originalStock === undefined || v.stock !== v.originalStock;
    if (edited && v.stock !== before) {
      writeStock.set(v.id, v.stock);
      changes.push({ variantId: v.id, previousStock: before, newStock: v.stock });
      finalStocks.push(v.stock);
    } else {
      finalStocks.push(before);
    }
  }

  return { writeStock, changes, totalStock: sumStock(finalStocks) };
}
