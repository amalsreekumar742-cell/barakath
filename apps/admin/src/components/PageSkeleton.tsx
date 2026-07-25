import type { FC } from 'react';
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

/**
 * PageSkeleton — full-page loading placeholder rendered inside the Layout content area.
 *
 * WHY a skeleton (not a spinner): per the design + skill Loading State Policy, list/content screens
 * show a skeleton that mirrors the real layout — never a bare spinner or blank screen. Warm-tinted
 * base/highlight match the design's neutral surfaces.
 */
const PageSkeleton: FC = () => {
  return (
    <SkeletonTheme baseColor="#ececec" highlightColor="#f8f8f8" borderRadius={8}>
      <div className="p-6" aria-busy="true" aria-label="Loading">
        {/* Title + action row */}
        <div className="mb-6 flex items-center justify-between">
          <Skeleton width={220} height={28} />
          <Skeleton width={130} height={38} borderRadius={8} />
        </div>

        {/* Summary tiles */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height={92} borderRadius={16} />
          ))}
        </div>

        {/* Table / list rows */}
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} height={52} borderRadius={12} />
          ))}
        </div>
      </div>
    </SkeletonTheme>
  );
};

export default PageSkeleton;
