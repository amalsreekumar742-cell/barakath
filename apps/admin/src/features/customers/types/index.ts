/**
 * Customers feature types (spec §1.8). `status` is '' for the "All" pill (no status constraint);
 * otherwise 'Active' | 'Blocked'. The detail page's four data tabs each paginate independently.
 */
export interface CustomerFilters {
  status: string;
  searchTerm: string;
}

/** Which data tab is active on the customer detail page (spec §1.8). */
export type CustomerTab = 'orders' | 'wallet' | 'affiliate' | 'addresses';
