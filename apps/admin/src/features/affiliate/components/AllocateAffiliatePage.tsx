import { type FC, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import type { UserProps } from '@barakath/shared/types';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import Icon from '@/components/icons/Icon';
import { searchAllocatableUsers } from '../api/searchAllocatableUsers';
import { allocateAffiliate } from '../api/allocateAffiliate';
import { clearAllocateSearch } from '../stores/affiliateSlice';
import { Avatar } from './ui';

const inputCls =
  'w-full rounded-md border border-border-strong bg-surface px-3 py-2.5 text-[14px] outline-none placeholder:text-faint focus:border-primary focus:ring-2 focus:ring-primary/20';

/**
 * AllocateAffiliatePage — route /affiliate/allocate (spec §1.14 Allocate Affiliate), the full inner page
 * from the prototype ("Growth › Affiliate › Allocate"). Search a customer WITHOUT an existing code, pick
 * one, and "Allocate" mints a "BAR"+6 referral code; on success it returns to the Affiliate page and toasts
 * the generated code. The referral code / commission / wallet fields mirror the design — the code is minted
 * server-side, commissions are managed per product on the Commissions tab, and the affiliate wallet is
 * initialised to ₹0, so those fields are shown read-only rather than as editable persisted inputs.
 */
const AllocateAffiliatePage: FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { allocateSearchResults, allocateSearchLoading, allocateLoading } = useAppSelector(
    (s) => s.affiliate,
  );

  const [term, setTerm] = useState('');
  const [selected, setSelected] = useState<UserProps | null>(null);

  // Clear any stale search state on mount and unmount.
  useEffect(() => {
    dispatch(clearAllocateSearch());
    return () => {
      dispatch(clearAllocateSearch());
    };
  }, [dispatch]);

  // Debounce the search term (300ms). Skip once a customer is selected.
  useEffect(() => {
    if (selected) return;
    const t = setTimeout(() => {
      if (term.trim()) void dispatch(searchAllocatableUsers(term));
      else dispatch(clearAllocateSearch());
    }, 300);
    return () => clearTimeout(t);
  }, [term, selected, dispatch]);

  const onAllocate = async () => {
    if (!selected) return;
    const res = await dispatch(allocateAffiliate({ userId: selected.id }));
    if (allocateAffiliate.fulfilled.match(res)) {
      toast.success(`Affiliate code ${res.payload.code} allocated to ${selected.fullName}`);
      navigate('/affiliate');
    } else {
      toast.error((res.payload as string) ?? 'Could not allocate code');
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => navigate('/affiliate')}
            className="mb-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-foreground"
          >
            <Icon name="ArrowLeftLine" size={15} /> Affiliate program
          </button>
          <h1 className="text-[24px] font-extrabold tracking-tight text-foreground">Allocate affiliate</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <button
            type="button"
            onClick={() => navigate('/affiliate')}
            disabled={allocateLoading}
            className="rounded-md border border-border-strong px-4 py-2.5 text-[14px] font-semibold text-foreground hover:bg-subtle disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onAllocate}
            disabled={!selected || allocateLoading}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {allocateLoading && <Icon name="Loader4Line" size={16} className="animate-spin" />}
            Allocate
          </button>
        </div>
      </div>

      {/* Form card */}
      <div className="max-w-[640px]">
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex flex-col gap-4">
            {/* Search customer */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-foreground">Search customer</span>
              {selected ? (
                <div className="flex items-center gap-3 rounded-md border border-border-strong bg-subtle/40 p-2.5">
                  <Avatar src={selected.profileImage} name={selected.fullName} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-foreground">{selected.fullName}</p>
                    <p className="truncate text-[12px] text-muted">
                      {selected.phone || '—'}
                      {selected.email ? ` · ${selected.email}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    disabled={allocateLoading}
                    className="rounded-md border border-border-strong px-3 py-1.5 text-[12px] font-semibold text-foreground hover:bg-subtle disabled:opacity-50"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint">
                      <Icon name="SearchLine" size={16} />
                    </span>
                    <input
                      autoFocus
                      value={term}
                      onChange={(e) => setTerm(e.target.value)}
                      placeholder="Search by name, phone or email…"
                      className={`${inputCls} pl-9`}
                    />
                  </div>
                  <div className="max-h-64 overflow-y-auto rounded-md border border-border">
                    {allocateSearchLoading ? (
                      <div className="flex items-center justify-center gap-2 p-6 text-[13px] text-muted">
                        <Icon name="Loader4Line" size={16} className="animate-spin" />
                        Searching…
                      </div>
                    ) : term.trim() && allocateSearchResults.length === 0 ? (
                      <p className="p-6 text-center text-[13px] text-muted">
                        No eligible customers found for “{term.trim()}”.
                      </p>
                    ) : !term.trim() ? (
                      <p className="p-6 text-center text-[13px] text-faint">
                        Type to search customers without an existing code.
                      </p>
                    ) : (
                      allocateSearchResults.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => setSelected(u)}
                          className="flex w-full items-center gap-3 border-b border-border px-3 py-2.5 text-left last:border-0 hover:bg-subtle/50"
                        >
                          <Avatar src={u.profileImage} name={u.fullName} size={36} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-semibold text-foreground">{u.fullName}</p>
                            <p className="truncate text-[12px] text-muted">
                              {u.phone || '—'}
                              {u.email ? ` · ${u.email}` : ''}
                            </p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Referral code (auto-generated on allocate) */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-foreground">Referral code</span>
              <div className="flex items-center justify-between rounded-md border border-border-strong bg-subtle/40 px-3 py-2.5 text-[14px] text-muted">
                <span className="font-mono">BAR••••••</span>
                <span className="text-[12px]">Generated automatically</span>
              </div>
            </div>

            {/* Commission + wallet (read-only, mirroring the design) */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <span className="text-[13px] font-semibold text-foreground">Commission rate</span>
                <div className="rounded-md border border-border-strong bg-subtle/40 px-3 py-2.5 text-[14px] text-muted">
                  Set per product
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[13px] font-semibold text-foreground">Wallet</span>
                <div className="rounded-md border border-border-strong bg-subtle/40 px-3 py-2.5 text-[14px] text-muted">
                  Affiliate wallet
                </div>
              </div>
            </div>

            {/* Enable affiliate wallet access — affiliates always get a wallet (initialised to ₹0). */}
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-foreground">Enable affiliate wallet access</span>
              <span className="relative h-6 w-11 shrink-0 rounded-pill bg-primary opacity-70" aria-hidden>
                <span className="absolute left-[22px] top-0.5 h-5 w-5 rounded-full bg-white shadow-sm" />
              </span>
            </div>
          </div>
        </div>

        <p className="mt-3 text-[12px] text-muted">
          A unique code (<span className="font-mono">BAR••••••</span>) is generated and the affiliate wallet
          is initialised to ₹0. Product-level commission rates are managed on the Commissions tab.
        </p>
      </div>
    </div>
  );
};

export default AllocateAffiliatePage;
