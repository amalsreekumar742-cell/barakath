import { type FC, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Skeleton from 'react-loading-skeleton';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import Icon from '@/components/icons/Icon';
import { formatINR } from '@/utils/format';
import { fetchAffiliateUsers } from '../api/fetchAffiliateUsers';
import { setAffiliateSearch } from '../stores/affiliateSlice';
import { Avatar, CopyableCode } from './ui';

const HEADERS = ['Affiliate', 'Phone', 'Code', 'Balance', 'Pending', 'Confirmed', 'Referrals', 'Wallet access'];

/**
 * AffiliatesListPage — every customer allocated an affiliate code (spec §1.14), opened from the
 * "Active affiliates" card. Same query as that card's count (`affiliateCode != ''`), so the two agree.
 * Search by name / phone; a row opens the affiliate's detail page with their transaction ledger.
 */
const AffiliatesListPage: FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const {
    affiliates,
    affiliatesHasMore,
    affiliatesLoading,
    affiliatesLoadingMore,
    affiliatesError,
    affiliatesLastVisible,
    affiliateSearch,
  } = useAppSelector((s) => s.affiliate);

  const [searchInput, setSearchInput] = useState(affiliateSearch);

  useEffect(() => {
    void dispatch(fetchAffiliateUsers({ searchTerm: affiliateSearch, cursor: null }));
  }, [dispatch, affiliateSearch]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput !== affiliateSearch) dispatch(setAffiliateSearch(searchInput));
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput, dispatch]);

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-[24px] font-extrabold leading-tight tracking-tight text-foreground">Affiliates</h1>
        <p className="mt-1.5 text-[13px] text-muted">Customers with an affiliate code — open one to see their transactions.</p>
      </div>

      <div className="relative mb-4 max-w-md">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint">
          <Icon name="SearchLine" size={16} />
        </span>
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by name or phone…"
          className="w-full rounded-md border border-border-strong bg-surface py-2.5 pl-9 pr-3 text-[14px] outline-none placeholder:text-faint focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {affiliatesLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} height={56} borderRadius={12} />
          ))}
        </div>
      ) : affiliatesError ? (
        <div className="rounded-xl border border-border bg-surface p-10 text-center">
          <p className="text-[14px] text-muted">{affiliatesError}</p>
          <button
            type="button"
            onClick={() => dispatch(fetchAffiliateUsers({ searchTerm: affiliateSearch, cursor: null }))}
            className="mt-3 rounded-md bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-dark"
          >
            Retry
          </button>
        </div>
      ) : affiliates.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary-subtle text-primary">
            <Icon name="UserHeartLine" size={28} />
          </div>
          <h2 className="text-[16px] font-bold text-foreground">
            {affiliateSearch ? 'No affiliates match your search' : 'No affiliates yet'}
          </h2>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
          <table className="w-full min-w-[960px]">
            <thead className="border-b border-border bg-subtle/50">
              <tr>
                {HEADERS.map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-faint"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {affiliates.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => navigate(`/affiliate/affiliates/${u.id}`)}
                  className="cursor-pointer border-b border-border last:border-0 hover:bg-subtle/40"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar src={u.profileImage} name={u.fullName} size={36} />
                      <span className="text-[13px] font-semibold text-foreground">{u.fullName || '—'}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-[13px] text-muted">{u.phone || '—'}</td>
                  <td className="px-5 py-3">
                    <CopyableCode code={u.affiliateCode} />
                  </td>
                  <td className="px-5 py-3 text-[13px] font-semibold text-foreground">
                    {formatINR(u.affiliateBalance ?? 0)}
                  </td>
                  <td className="px-5 py-3 text-[13px] text-gold-strong">{formatINR(u.pendingCommission ?? 0)}</td>
                  <td className="px-5 py-3 text-[13px] text-success">{formatINR(u.confirmedCommission ?? 0)}</td>
                  <td className="px-5 py-3 text-[13px] text-muted">{u.totalReferrals ?? 0}</td>
                  <td className="px-5 py-3">
                    {/* Opt-in: a missing flag means no wallet access (see UserProps.affiliateEnabled). */}
                    <span
                      className={`inline-flex items-center rounded-sm px-2 py-0.5 text-[11px] font-bold ${
                        u.affiliateEnabled ? 'bg-success-subtle text-success' : 'bg-subtle text-muted'
                      }`}
                    >
                      {u.affiliateEnabled ? 'Enabled' : 'Off'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {affiliatesLoadingMore && (
            <div className="p-3">
              <Skeleton height={44} borderRadius={8} />
            </div>
          )}
          {affiliatesHasMore && !affiliatesLoadingMore && (
            <div className="flex justify-center border-t border-border p-3">
              <button
                type="button"
                onClick={() =>
                  dispatch(fetchAffiliateUsers({ searchTerm: affiliateSearch, cursor: affiliatesLastVisible }))
                }
                className="rounded-md border border-border-strong px-4 py-2 text-[14px] font-semibold text-foreground hover:bg-subtle"
              >
                View More
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AffiliatesListPage;
