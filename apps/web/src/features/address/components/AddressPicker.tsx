'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { UserAddressProps } from '@barakath/shared';
import { Button } from '@/components/Button';
import { AddressCard } from './AddressCard';
import { AddressForm } from './AddressForm';
import type { AddressFormValues } from '../utils/addressSchema';

export interface AddressPickerProps {
  addresses: UserAddressProps[];
  selectedId: string | null;
  onSelect: (addressId: string) => void;
  onAdd: (values: AddressFormValues) => Promise<void>;
  onDelete: (addressId: string) => Promise<void>;
  loading?: boolean;
  adding?: boolean;
  deletingId?: string | null;
}

/**
 * Radio list of `AddressCard`s + "Add new address" (spec §2.14) — the checkout section's delivery
 * address picker. `AddressCard`'s delete action is also exposed here so a customer can prune a stale
 * address without leaving checkout; the "first added = default" / "delete default → next oldest
 * promotes" rules live in `features/address/api/addresses.ts`, which `onAdd`/`onDelete` are expected
 * to be wired to (this component itself holds no Firestore knowledge).
 */
export function AddressPicker({
  addresses,
  selectedId,
  onSelect,
  onAdd,
  onDelete,
  loading = false,
  adding = false,
  deletingId = null,
}: AddressPickerProps) {
  const [showForm, setShowForm] = useState(false);

  async function handleAdd(values: AddressFormValues) {
    await onAdd(values);
    setShowForm(false);
  }

  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true">
        {[0, 1].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-subtle" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {addresses.length === 0 && !showForm && (
        <p className="rounded-lg border border-dashed border-border-strong p-4 text-center text-sm text-muted">
          No saved addresses yet — add one to continue.
        </p>
      )}

      <div role="radiogroup" aria-label="Delivery address" className="space-y-3">
        {addresses.map((address) => (
          <AddressCard
            key={address.id}
            address={address}
            selectable
            selected={address.id === selectedId}
            onSelect={() => onSelect(address.id)}
            onDelete={() => onDelete(address.id)}
            deleting={deletingId === address.id}
          />
        ))}
      </div>

      {showForm ? (
        <div className="rounded-lg border border-border-strong bg-surface p-4">
          <AddressForm
            onSubmit={handleAdd}
            onCancel={() => setShowForm(false)}
            submitting={adding}
            isFirstAddress={addresses.length === 0}
          />
        </div>
      ) : (
        <Button variant="secondary" size="md" iconLeft={<Plus size={16} />} onClick={() => setShowForm(true)}>
          Add new address
        </Button>
      )}
    </div>
  );
}
