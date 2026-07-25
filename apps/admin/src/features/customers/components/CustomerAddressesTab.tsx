import { type FC, useEffect } from 'react';
import Skeleton from 'react-loading-skeleton';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import Icon from '@/components/icons/Icon';
import { fetchCustomerAddresses } from '../api/fetchCustomerAddresses';

/**
 * CustomerAddressesTab — read-only cards of the customer's saved delivery addresses (spec §1.8 Addresses
 * tab; admin cannot edit them). Loads lazily on mount. The default address carries a "Default" badge.
 */
const CustomerAddressesTab: FC<{ userId: string }> = ({ userId }) => {
  const dispatch = useAppDispatch();
  const { addresses, addressesLoading } = useAppSelector((s) => s.customers);

  useEffect(() => {
    void dispatch(fetchCustomerAddresses(userId));
  }, [dispatch, userId]);

  if (addressesLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} height={130} borderRadius={12} />
        ))}
      </div>
    );
  }

  if (addresses.length === 0) {
    return <p className="py-10 text-center text-[14px] text-muted">No saved addresses</p>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {addresses.map((a) => (
        <div key={a.id} className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-subtle text-primary">
                <Icon name="MapPinLine" size={16} />
              </span>
              <p className="text-[14px] font-semibold text-foreground">{a.fullName}</p>
            </div>
            {a.isDefault && (
              <span className="inline-flex items-center rounded-sm bg-primary-subtle px-2 py-0.5 text-[11px] font-bold text-primary">
                Default
              </span>
            )}
          </div>
          <div className="space-y-0.5 text-[13px] text-muted">
            <p>{a.phone}</p>
            <p>{a.addressLine1}</p>
            {a.addressLine2 && <p>{a.addressLine2}</p>}
            <p>
              {a.city}, {a.state} — {a.pincode}
            </p>
            {a.landmark && <p>Landmark: {a.landmark}</p>}
          </div>
        </div>
      ))}
    </div>
  );
};

export default CustomerAddressesTab;
