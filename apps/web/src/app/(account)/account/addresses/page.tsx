'use client';

import { useState } from 'react';
import { MapPinned, Plus } from 'lucide-react';
import type { UserAddressProps } from '@barakath/shared';
import { useAppSelector } from '@/stores/store';
import { Breadcrumb } from '@/components/Breadcrumb';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { useAddresses } from '@/features/address/hooks/useAddresses';
import { AddressCard } from '@/features/address/components/AddressCard';
import { AddressForm } from '@/features/address/components/AddressForm';
import type { AddressFormValues } from '@/features/address/utils/addressSchema';
import { toastError, toastSuccess } from '@/lib/toast';
import { AccountPageHeader } from '@/features/account/components/AccountPageHeader';

/**
 * /account/addresses (spec 3.17) — list, add and delete a customer's saved delivery addresses.
 *
 * WHY the header is now `AccountPageHeader`: this page was originally built (Web Batch 3) before the
 * account sidebar shell existed, with its own inline title/subtitle/button block. Batch 4 (D0) wraps
 * every /account/* page in a persistent sidebar (spec 3.10) and pulls that inline block out into the
 * shared `AccountPageHeader` so this page matches every other account screen instead of being the one
 * with a bespoke header. The Breadcrumb stays (spec 3.24: breadcrumb navigation on all pages) — the
 * sidebar replaces nothing about it.
 *
 * WHY `AddressCard`s assembled directly instead of `AddressPicker`: `AddressPicker` bakes in radio-
 * selection semantics (a `radiogroup`, a `selectedId`, a filled dot per card) built for checkout's
 * "choose ONE address to ship to" job. This screen's job is different — show every saved address with
 * a delete action, no selection at all — so `AddressCard` with `selectable` left at its default
 * (false) is the direct fit; reaching for `AddressPicker` here would mean fighting its selection UI
 * off rather than reusing anything real.
 *
 * Delete + add only — there is no edit anywhere in this flow (spec 2.14/3.17, and `AddressForm` has no
 * edit mode by design). The hook already re-fetches after a delete, so whichever address the server
 * promoted to default (next-oldest remaining) is reflected automatically — never re-derived here.
 */
export default function AddressesPage() {
  const uid = useAppSelector((s) => s.auth.uid);
  const authLoading = useAppSelector((s) => s.auth.authLoading);
  const { addresses, loading, mutating, add, remove } = useAddresses(uid);

  const [showAddModal, setShowAddModal] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<UserAddressProps | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Auth resolves a beat after mount (see authSlice's `authLoading` doc) — waiting on it too avoids a
  // flash of the empty state for a customer who does in fact have saved addresses.
  const isLoading = authLoading || loading;

  async function handleAdd(values: AddressFormValues) {
    try {
      await add(values);
      toastSuccess('Address added');
      setShowAddModal(false);
    } catch (error) {
      toastError(error, 'Could not add this address. Please try again.');
    }
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await remove(pendingDelete.id);
      toastSuccess('Address removed');
      setPendingDelete(null);
    } catch (error) {
      toastError(error, 'Could not remove this address. Please try again.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'My Addresses' }]} />

      <AccountPageHeader
        title="My Addresses"
        subtitle="Manage the delivery addresses saved to your account."
        action={
          <Button variant="primary" iconLeft={<Plus size={16} />} onClick={() => setShowAddModal(true)}>
            Add New Address
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-lg bg-subtle" />
          ))}
        </div>
      ) : addresses.length === 0 ? (
        <EmptyState
          icon={<MapPinned size={40} />}
          title="No saved addresses yet"
          subtitle="Add a delivery address to speed up checkout next time."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {addresses.map((address) => (
            <AddressCard
              key={address.id}
              address={address}
              onDelete={() => setPendingDelete(address)}
              deleting={deleting && pendingDelete?.id === address.id}
            />
          ))}
        </div>
      )}

      <Modal
        isOpen={showAddModal}
        onClose={() => {
          if (!mutating) setShowAddModal(false);
        }}
        maxWidth="max-w-xl"
        labelledBy="add-address-heading"
      >
        <div className="max-h-[85vh] overflow-y-auto rounded-xl border border-border bg-surface p-6 shadow-lg">
          <h2 id="add-address-heading" className="font-display text-lg font-semibold text-foreground">
            Add new address
          </h2>
          <div className="mt-4">
            <AddressForm
              onSubmit={handleAdd}
              onCancel={() => setShowAddModal(false)}
              submitting={mutating}
              isFirstAddress={addresses.length === 0}
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title="Remove this address?"
        description={
          pendingDelete
            ? `Delete the ${pendingDelete.label} address for ${pendingDelete.fullName}? This cannot be undone.`
            : undefined
        }
        confirmLabel="Remove"
        destructive
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onClose={() => {
          if (!deleting) setPendingDelete(null);
        }}
      />
    </div>
  );
}
