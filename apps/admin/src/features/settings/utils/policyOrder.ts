/**
 * Pure ordering helpers for Settings › Policies. No Firebase here — the reorder thunk feeds the result
 * straight into one writeBatch, and the unit test exercises the decision without touching Firestore.
 */

/** One document's `order` change produced by a move. */
export interface PolicyOrderChange {
  id: string;
  from: number;
  to: number;
}

/** The minimum a row needs for ordering decisions (a PolicyProps satisfies it). */
interface OrderedRow {
  id: string;
  name: string;
  order: number;
}

/**
 * The display sort for the admin list: `order` ascending, then name.
 * WHY a name tie-break: "Display order" is typed by admins, so two policies can share a value. Without a
 * deterministic second key the two rows could swap places between fetches, and `policyMoveChanges`
 * (which works on the displayed index) would then move the wrong neighbour.
 */
export function comparePolicies(a: OrderedRow, b: OrderedRow): number {
  return a.order - b.order || a.name.localeCompare(b.name);
}

/**
 * The `order` changes for moving `items[index]` one step up (`-1`) or down (`+1`) in the displayed list.
 * `items` must already be sorted with `comparePolicies`. Returns `[]` when there is no neighbour (the
 * row is already at that end) or the index is out of range.
 *
 * WHY swap the two neighbours' values (not renumber the whole list 1..n): at most TWO documents change
 * per move, so the batch stays tiny, gaps an admin typed on purpose survive, and nobody else's
 * `order` is rewritten by a click on an unrelated row.
 *
 * WHY special-case equal orders: swapping two equal values is a no-op, so the arrow would appear dead.
 * Instead only ONE doc moves just past its neighbour — up to `order - 1` (or, when the neighbour is
 * already at 1 and nothing can go lower, the neighbour moves down to `order + 1`), down to `order + 1`.
 */
export function policyMoveChanges(
  items: readonly OrderedRow[],
  index: number,
  dir: -1 | 1,
): PolicyOrderChange[] {
  const a = items[index];
  const b = items[index + dir];
  if (!a || !b) return [];

  if (a.order !== b.order) {
    return [
      { id: a.id, from: a.order, to: b.order },
      { id: b.id, from: b.order, to: a.order },
    ];
  }

  if (dir === -1 && b.order > 1) return [{ id: a.id, from: a.order, to: b.order - 1 }];
  if (dir === -1) return [{ id: b.id, from: b.order, to: b.order + 1 }];
  return [{ id: a.id, from: a.order, to: b.order + 1 }];
}
