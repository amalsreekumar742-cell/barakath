import { ProductGridSkeleton } from '@/components/catalog/ProductGridSkeleton';
import { SkeletonText } from '@/components/Skeleton';
import { Constants } from '@/config/constants';
import { SEARCH_RESULTS_GRID_CLASS } from '@/features/search/results/constants';

/**
 * Initial-load skeleton for /search — keyed to the page's own 5/3/2-col grid (`SEARCH_RESULTS_GRID_CLASS`,
 * wider than the standard 4-up listing grid) so nothing reflows when the real cards replace it.
 */
export default function SearchLoading() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-16 lg:px-5" aria-busy="true">
      <div className="py-3">
        <SkeletonText width="w-40" className="h-4" />
      </div>

      <div className="mb-1">
        <SkeletonText width="w-64" className="h-7" />
      </div>
      <div className="mb-5">
        <SkeletonText width="w-40" className="h-4" />
      </div>

      <ProductGridSkeleton count={Constants.PAGE_SIZE} className={SEARCH_RESULTS_GRID_CLASS} />
    </main>
  );
}
