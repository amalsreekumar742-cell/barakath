import type { FC } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { segmentToLabel } from '@/config/navigation';
import { useAppSelector } from '@/stores/store';

/**
 * Breadcrumb — auto-generated from the current route path (spec §1.22, breadcrumb on all pages).
 *
 * WHY derive from the URL (not manual props per page): every page renders inside the same Layout, so
 * generating the trail from `useLocation` means no page has to hand-maintain its breadcrumb — it stays
 * correct as routes are added. Segments map to display names via the shared `segmentLabels`; unknown
 * segments (e.g. a dynamic id) fall back to a title-cased raw value.
 * WHY every segment but the last is a link: the last crumb is the current page (not navigable);
 * earlier crumbs navigate back to their cumulative path.
 * WHY `segmentToLabel` lives in config/navigation: the browser tab title derives from the same route,
 * and one shared mapper keeps the two from drifting when a nav label is renamed.
 */
const Breadcrumb: FC = () => {
  const { pathname } = useLocation();
  const segments = pathname.split('/').filter(Boolean);
  // Customer detail (/customers/:id): once loaded, show the real name instead of the raw id fallback.
  const customerDetail = useAppSelector((s) => s.customers.customerDetail);

  // Root ("/") is the Dashboard — show a single, non-clickable crumb.
  const crumbs =
    segments.length === 0
      ? [{ label: 'Dashboard', to: '/' }]
      : segments.map((seg, i) => {
          const to = '/' + segments.slice(0, i + 1).join('/');
          if (segments[0] === 'customers' && i === 1 && customerDetail?.id === seg) {
            return { label: customerDetail.fullName, to };
          }
          return { label: segmentToLabel(seg), to };
        });

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[14px]">
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={crumb.to} className="flex items-center gap-1">
            {i > 0 && (
              <span className="text-faint" aria-hidden>
                ›
              </span>
            )}
            {isLast ? (
              <span className="font-semibold text-foreground" aria-current="page">
                {crumb.label}
              </span>
            ) : (
              <Link to={crumb.to} className="text-muted transition-colors hover:text-primary">
                {crumb.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
};

export default Breadcrumb;
