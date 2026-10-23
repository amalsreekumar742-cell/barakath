import { SkeletonText } from '@/components/Skeleton';

/**
 * Initial-load skeleton for /policies/[policyId] — breadcrumb, title, "Last updated", then paragraph
 * lines shaped like the legal text, so the page does not jump when the content lands. Overrides the
 * list skeleton in `../loading.tsx`, which is the wrong shape for a single document.
 */
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-[820px] px-5 pb-16" aria-busy="true">
      <div className="py-3">
        <SkeletonText width="w-48" className="h-4" />
      </div>
      <SkeletonText width="w-64" className="h-8" />
      <SkeletonText width="w-36" className="mt-2.5" />
      <div className="mt-8 space-y-6">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="space-y-2.5">
            <SkeletonText width="w-1/3" className="h-5" />
            <SkeletonText />
            <SkeletonText />
            <SkeletonText width="w-4/5" />
          </div>
        ))}
      </div>
    </main>
  );
}
