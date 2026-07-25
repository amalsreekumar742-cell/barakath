'use client';

import { useState } from 'react';
import { MapPin, Pencil } from 'lucide-react';
import type { UserAddressProps } from '@barakath/shared';
import { Modal } from '@/components/Modal';
import { Button } from '@/components/Button';
import { SkeletonText } from '@/components/Skeleton';
import { AddressForm } from '@/features/address/components/AddressForm';
import { AddressPicker } from '@/features/address/components/AddressPicker';
import type { AddressFormValues } from '@/features/address/utils/addressSchema';

export interface AddressBlockProps {
  addresses: UserAddressProps[];
  selectedId: string | null;
  loading: boolean;
  mutating: boolean;
  onSelect: (addressId: string) => void;
  onAdd: (values: AddressFormValues) => Promise<void>;
  onDelete: (addressId: string) => Promise<void>;
}

/**
 * Delivery address block (spec 2.13/2.14): the selected address summary + "Change" opening
 * `AddressPicker` in the shared `Modal`, or — when the customer has no saved address at all —
 * `AddressForm` rendered inline so there is nothing to "change" to yet. This component holds no
 * Firestore knowledge of its own; `CheckoutSection` wires it to `useAddresses(uid)`.
 *
 * WHY a modal for "Change" rather than an inline expand: the picker also hosts "Add new address"
 * (its own inline form) and per-address delete — letting all of that grow in place under the summary
 * would push the payment/summary blocks below it down unpredictably. The `Modal` is the app's one
 * reusable dialog primitive (react-nextjs-skill) for exactly this kind of self-contained sub-flow.
 */
export function AddressBlock({
  addresses,
  selectedId,
  loading,
  mutating,
  onSelect,
  onAdd,
  onDelete,
}: AddressBlockProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const selected = addresses.find((a) => a.id === selectedId) ?? null;

  async function handleDelete(addressId: string) {
    setDeletingId(addressId);
    try {
      await onDelete(addressId);
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-2 rounded-lg border border-border-strong bg-surface p-4" aria-busy="true">
        <SkeletonText width="w-1/3" />
        <SkeletonText width="w-2/3" />
        <SkeletonText width="w-1/2" />
      </div>
    );
  }

  return (
    <div>
      <h3 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-muted">Delivery address</h3>

      {addresses.length === 0 ? (
        // No saved address at all — nothing to "change" to, so the add form renders inline instead of
        // behind a modal the customer would just have to open immediately.
        <div className="rounded-lg border border-border-strong bg-surface p-4">
          <p className="mb-3 text-sm text-muted">Add a delivery address to continue.</p>
          <AddressForm onSubmit={onAdd} submitting={mutating} isFirstAddress />
        </div>
      ) : selected ? (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-border-strong bg-surface p-4">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-foreground">
              <MapPin size={14} />
              {selected.label}
            </span>
            <p className="mt-1 text-sm font-medium text-foreground">{selected.fullName}</p>
            <p className="mt-0.5 text-sm text-muted">
              {[selected.addressLine1, selected.addressLine2, selected.city, selected.state, selected.pincode]
                .filter((part) => part && part.trim().length > 0)
                .join(', ')}
            </p>
            <p className="mt-0.5 text-sm text-muted">{selected.phone}</p>
          </div>
          <Button variant="secondary" size="sm" iconLeft={<Pencil size={14} />} onClick={() => setPickerOpen(true)}>
            Change
          </Button>
        </div>
      ) : (
        // Addresses exist but none is selected yet (shouldn't happen once auto-select runs, but a
        // customer could theoretically land here mid-hydration) — prompt to pick one explicitly.
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="w-full rounded-lg border border-dashed border-border-strong p-4 text-left text-sm font-medium text-primary hover:bg-primary-subtle"
        >
          Select a delivery address
        </button>
      )}

      <Modal isOpen={pickerOpen} onClose={() => setPickerOpen(false)} maxWidth="max-w-lg" labelledBy="address-picker-title">
        <div className="max-h-[85vh] overflow-y-auto rounded-xl bg-surface p-5">
          <h2 id="address-picker-title" className="mb-4 font-display text-base font-extrabold text-foreground">
            Choose a delivery address
          </h2>
          <AddressPicker
            addresses={addresses}
            selectedId={selectedId}
            onSelect={(id) => {
              onSelect(id);
              setPickerOpen(false);
            }}
            onAdd={onAdd}
            onDelete={handleDelete}
            adding={mutating}
            deletingId={deletingId}
          />
        </div>
      </Modal>
    </div>
  );
}
