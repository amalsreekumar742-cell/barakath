import type { SpinnerSlotProps } from '@barakath/shared';

/**
 * Finds which wedge the server's `slotLabel` refers to, so the wheel knows where to animate.
 *
 * WHY a string match on `label`, not an id: `spinWheel`'s response (WEB_BATCH4_NOTES.md §8, confirmed
 * against `functions/src/growth/spinWheel.ts`) carries `slotLabel` only — the callable never returns
 * which array index or `slot.id` won. Campaign slot labels are admin-authored and expected unique in
 * practice (the admin panel is the only place slots are created), but the data model does NOT enforce
 * that uniqueness, so this is a best-effort match, not a guaranteed one: a duplicate label resolves to
 * whichever slot appears first in the array. Falls back to wedge 0 (never throws) when no label matches
 * at all — a wheel that lands somewhere beats a crash on a response the client can't fully explain.
 */
export function findSlotIndex(slots: SpinnerSlotProps[], slotLabel: string): number {
  const label = slotLabel.trim();
  const index = slots.findIndex((s) => s.label.trim() === label);
  return index >= 0 ? index : 0;
}
