import { type FC, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Skeleton from 'react-loading-skeleton';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { UserStatus } from '@barakath/shared/config/enums';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import Icon from '@/components/icons/Icon';
import ConfirmDialog from '@/components/ConfirmDialog';
import { fetchCustomerDetail } from '../api/fetchCustomerDetail';
import { toggleCustomerStatus } from '../api/toggleCustomerStatus';
import { setAffiliateEnabled } from '../api/setAffiliateEnabled';
import { exportCustomerTabCSV } from '../api/exportCustomerTabCSV';
import { setCustomerTab, resetCustomerDetail } from '../stores/customersSlice';
import { Avatar, Toggle } from './ui';
import CustomerOrdersTab from './CustomerOrdersTab';
import CustomerWalletTab from './CustomerWalletTab';
import CustomerAffiliateTab from './CustomerAffiliateTab';
import CustomerAddressesTab from './CustomerAddressesTab';
import type { CustomerTab } from '../types';

// Design (screens 12/45/46): Orders / Wallet / Affiliate wallet as chip tabs. Addresses has no design
// counterpart but is real, working functionality (saved address book) — kept as a 4th tab per product
// decision rather than dropped just because the mockup doesn't show it.
const TABS: { label: string; value: CustomerTab }[] = [
  { label: 'Orders', value: 'orders' },
  { label: 'Wallet', value: 'wallet' },
  { label: 'Affiliate wallet', value: 'affiliate' },
  { label: 'Addresses', value: 'addresses' },
];

/**
 * CustomerDetailPage — sidebar (profile + affiliate marketing) next to a chip-tabbed content column
 * (spec §1.8, design screens 12/45/46). Block/Unblock and Export act on whichever tab is open; each tab
 * fetches its own data on first activation. State is cleared on unmount so a different customer never
 * shows stale tab data.
 */
const CustomerDetailPage: FC = () => {
  const { id = '' } = useParams();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { customerDetail, detailLoading, detailError, toggleStatusLoading, affiliateToggleLoading, exportTabLoading, activeTab } =
    useAppSelector((s) => s.customers);

  const [confirmBlock, setConfirmBlock] = useState(false);

  useEffect(() => {
    void dispatch(fetchCustomerDetail(id));
    return () => {
      dispatch(resetCustomerDetail());
    };
  }, [dispatch, id]);

  const customer = customerDetail;
  const isBlocked = customer?.status === UserStatus.BLOCKED;
  const affiliateOn = customer?.affiliateEnabled !== false;

  const doToggle = async () => {
    if (!customer) return;
    const newStatus = isBlocked ? UserStatus.ACTIVE : UserStatus.BLOCKED;
    const res = await dispatch(toggleCustomerStatus({ userId: customer.id, newStatus }));
    setConfirmBlock(false);
    if (toggleCustomerStatus.fulfilled.match(res)) {
      toast.success(`Customer ${newStatus === UserStatus.BLOCKED ? 'blocked' : 'unblocked'}`);
    } else {
      toast.error((res.payload as string) ?? 'Could not update customer');
    }
  };

  const doToggleAffiliate = async (on: boolean) => {
    if (!customer) return;
    const res = await dispatch(setAffiliateEnabled({ userId: customer.id, enabled: on }));
    if (setAffiliateEnabled.fulfilled.match(res)) {
      toast.success(on ? 'Affiliate access enabled' : 'Affiliate access disabled');
    } else {
      toast.error((res.payload as string) ?? 'Could not update affiliate access');
    }
  };

  const doExport = () => {
    if (!customer || activeTab === 'addresses') return;
    void dispatch(exportCustomerTabCSV({ userId: customer.id, customerName: customer.fullName, tab: activeTab }));
  };

  const copyReferralCode = (code: string) => {
    void navigator.clipboard?.writeText(code).then(
      () => toast.success('Referral code copied'),
      () => toast.error('Could not copy'),
    );
  };

  if (detailLoading) {
    return (
      <div className="p-6">
        <Skeleton height={32} width={220} />
        <div className="mt-4 grid gap-5 lg:grid-cols-[300px_1fr]">
          <div className="space-y-4">
            <Skeleton height={140} borderRadius={12} />
            <Skeleton height={100} borderRadius={12} />
          </div>
          <Skeleton height={320} borderRadius={12} />
        </div>
      </div>
    );
  }

  if (detailError || !customer) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-border bg-surface p-10 text-center">
          <p className="text-[14px] text-muted">{detailError ?? 'Customer not found'}</p>
          <button
            type="button"
            onClick={() => navigate('/customers')}
            className="mt-3 rounded-md bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-dark"
          >
            Back to customers
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-[22px] font-extrabold tracking-tight text-foreground">{customer.fullName}</h1>
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={doExport}
            disabled={activeTab === 'addresses' || exportTabLoading}
            className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-4 py-2.5 text-[14px] font-semibold text-foreground hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name="ArrowDownLine" size={16} />
            Export data
          </button>
          <button
            type="button"
            onClick={() => setConfirmBlock(true)}
            className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2.5 text-[14px] font-semibold ${
              isBlocked
                ? 'bg-success text-white hover:brightness-95'
                : 'border border-error text-error hover:bg-error-subtle'
            }`}
          >
            <Icon name={isBlocked ? 'CheckLine' : 'CloseLine'} size={16} />
            {isBlocked ? 'Unblock Customer' : 'Block Customer'}
          </button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        {/* Left: profile + affiliate marketing */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <Avatar src={customer.profileImage} name={customer.fullName} size={48} />
              <div>
                <p className="text-[15px] font-extrabold text-foreground">{customer.fullName}</p>
                <p className="mt-1 text-[12px] font-medium text-faint">
                  Member since {customer.createdAt ? format(customer.createdAt.toDate(), 'yyyy') : '—'}
                </p>
              </div>
            </div>
            <div className="mt-3.5 space-y-2 text-[12px] font-medium text-muted">
              <p className="flex items-center gap-1.5">
                <Icon name="User1Line" size={13} /> {customer.phone || '—'}
              </p>
              {customer.email && (
                <p className="flex items-center gap-1.5">
                  <Icon name="MailLine" size={13} /> {customer.email}
                </p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[13px] font-bold text-foreground">Affiliate marketing</p>
                <p className="mt-1 text-[11px] font-medium text-faint">Enable affiliate access &amp; wallet</p>
              </div>
              <Toggle on={affiliateOn} onChange={doToggleAffiliate} disabled={affiliateToggleLoading} />
            </div>
            {customer.affiliateCode && (
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                <span className="text-[12px] font-medium text-faint">Referral code</span>
                <button
                  type="button"
                  onClick={() => copyReferralCode(customer.affiliateCode)}
                  className="inline-flex items-center gap-1.5 font-mono text-[13px] font-extrabold tracking-wide text-primary hover:underline"
                >
                  {customer.affiliateCode}
                  <Icon name="Share2Line" size={12} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: chip tabs + content */}
        <div>
          <div className="mb-4 flex flex-wrap gap-2">
            {TABS.map((tab) => {
              const active = activeTab === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => dispatch(setCustomerTab(tab.value))}
                  className={`shrink-0 whitespace-nowrap rounded-pill px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                    active
                      ? 'bg-primary text-white'
                      : 'border border-border-strong text-muted hover:bg-subtle hover:text-foreground'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {activeTab === 'orders' && <CustomerOrdersTab userId={customer.id} />}
          {activeTab === 'wallet' && <CustomerWalletTab customer={customer} />}
          {activeTab === 'affiliate' && <CustomerAffiliateTab customer={customer} />}
          {activeTab === 'addresses' && <CustomerAddressesTab userId={customer.id} />}
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmBlock}
        title={isBlocked ? 'Unblock customer?' : 'Block customer?'}
        message={
          isBlocked
            ? "This will restore the customer's access."
            : 'This will prevent the customer from placing new orders.'
        }
        confirmLabel={isBlocked ? 'Unblock' : 'Block'}
        confirmVariant={isBlocked ? 'primary' : 'danger'}
        loading={toggleStatusLoading}
        onConfirm={doToggle}
        onCancel={() => setConfirmBlock(false)}
      />
    </div>
  );
};

export default CustomerDetailPage;
