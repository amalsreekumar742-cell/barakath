'use client';

import { useCallback, useEffect, useState } from 'react';
import type { UserAddressProps } from '@barakath/shared';
import { createAddress, deleteAddressAndPromote, listAddresses } from '../api/addresses';
import type { AddressFormValues } from '../utils/addressSchema';

export interface UseAddressesResult {
  addresses: UserAddressProps[];
  loading: boolean;
  error: string | null;
  /** An add/delete is in flight — drives the form/delete-button spinner. */
  mutating: boolean;
  refetch: () => Promise<void>;
  add: (values: AddressFormValues) => Promise<UserAddressProps>;
  remove: (addressId: string) => Promise<void>;
}

/**
 * Local (non-Redux) data hook over `features/address/api/addresses.ts` — see that file's header for
 * why this feature deliberately has no global slice. Both C2 (checkout's address picker) and C5
 * (`/account/addresses`) are expected to call this rather than re-implementing the fetch/add/delete
 * wiring, keeping the "no edit, add/delete only, first-added-is-default, delete-default-promotes-
 * next-oldest" rules in exactly one place.
 */
export function useAddresses(uid: string | null): UseAddressesResult {
  const [addresses, setAddresses] = useState<UserAddressProps[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);

  const refetch = useCallback(async () => {
    if (!uid) {
      setAddresses([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setAddresses(await listAddresses(uid));
    } catch {
      setError('Could not load your addresses.');
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const add = useCallback(
    async (values: AddressFormValues) => {
      if (!uid) throw new Error('Sign in to add an address.');
      setMutating(true);
      try {
        const created = await createAddress(uid, values);
        // Optimistic prepend; a promoted-default from a PRIOR delete elsewhere is already reflected
        // via `refetch`, so this only ever adds a genuinely new row.
        setAddresses((prev) => [created, ...(created.isDefault ? prev.map((a) => ({ ...a, isDefault: false })) : prev)]);
        return created;
      } finally {
        setMutating(false);
      }
    },
    [uid],
  );

  const remove = useCallback(
    async (addressId: string) => {
      if (!uid) return;
      setMutating(true);
      try {
        await deleteAddressAndPromote(uid, addressId);
        // Re-fetch rather than optimistically splice: which address gets promoted to default is
        // decided server-side (oldest remaining) and is simplest to reflect correctly by re-reading.
        await refetch();
      } finally {
        setMutating(false);
      }
    },
    [uid, refetch],
  );

  return { addresses, loading, error, mutating, refetch, add, remove };
}
