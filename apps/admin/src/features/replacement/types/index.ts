/**
 * Feature-local types for the Replacement module (spec §1.10). Kept out of the shared package because
 * they describe admin-panel UI state (list filters, tab counts, the detail bundle), not the Firestore
 * document contract — that lives in `@barakath/shared/types` (ReplacementProps).
 */
import type { OrderProps, ReplacementProps } from '@barakath/shared/types';

/**
 * Active replacement-list filters (spec §1.10). `status` is one of the three tab values (never '' —
 * every tab maps to a concrete status), `searchTerm` runs on the doc `keywords` field.
 */
export interface ReplacementFilters {
  status: string;
  searchTerm: string;
}

/** Per-status tab counts shown on the Replacement page (spec §1.10). `all` is the total across statuses. */
export interface ReplacementStatusCounts {
  all: number;
  pending: number;
  approved: number;
  rejected: number;
}

/**
 * The detail bundle for one request: the replacement doc plus the ORIGINAL order it references.
 * `order` is null when that order was since deleted (the detail page still renders the request).
 */
export interface ReplacementDetailBundle {
  replacement: ReplacementProps;
  order: OrderProps | null;
}
