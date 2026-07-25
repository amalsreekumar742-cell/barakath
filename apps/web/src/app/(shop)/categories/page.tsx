import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { Layers } from 'lucide-react';
import type { CategoryProps } from '@barakath/shared';
import { Breadcrumb } from '@/components/Breadcrumb';
import { EmptyState } from '@/components/EmptyState';
import { buildMetadata } from '@/lib/seo';
import { getCategories } from '@/lib/data/catalog';

/**
 * /categories — the full category directory (spec 3.5).
 *
 * WHY no `getSubCategories()` fan-out: `CategoryProps.subCategoryNames` is already denormalized onto
 * the category document itself (packages/shared/src/types/category.ts) — the admin's
 * addSubCategory/deleteSubCategory writes keep it in sync specifically so a list of categories can
 * render its sub-category names without a second read per row. A `Promise.all` of
 * `getSubCategories(categoryId)` per category would spend N extra subcollection reads fetching data
 * that already sits on the doc `getCategories()` just returned — worse than "parallel", it is
 * unnecessary. This corrects an assumption in the original task brief the same way the banner model
 * needed correcting: build against the schema that exists, not the one a generic brief assumes.
 *
 * WHY no product count: spec 3.5 explicitly removes it from this card (unlike the shared
 * `CategoryCard`, which falls back to the count only for a category with zero sub-categories).
 *
 * WHY `revalidate = 300`: same ISR window as every other catalog page (see serverFirestore.ts) — a
 * category/sub-category rename shows up within five minutes without a redeploy.
 */
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: 'All Categories',
    description:
      'Browse every Barakath category — perfumes, books, clothing and Islamic essentials — and jump straight to a sub-category.',
    path: '/categories',
  });
}

/**
 * `ItemList` JSON-LD for the category grid.
 *
 * WHY not `itemListSchema` from `lib/seo`: that builder is product-specific — it hard-codes
 * `/product/{id}` URLs and takes `ProductProps[]`. Feeding it categories would either fail to
 * typecheck or, worse, emit structured data that links to nonexistent product pages. This is a small,
 * page-local twin using the same shape, pointed at `/category/{name}` instead.
 */
function categoryItemListSchema(categories: CategoryProps[]) {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? '';
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: categories.map((category, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: category.name,
      url: `${base}/category/${encodeURIComponent(category.name)}`,
    })),
  };
}

export default async function CategoriesPage() {
  // Bounded single read (Constants.MAX_CATEGORIES) — the whole point of the denormalized
  // `subCategoryNames` field is that this ONE read is enough to render the whole grid.
  const categories = await getCategories();

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-16 lg:px-5">
      <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Categories' }]} />

      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
          Shop by category
        </h1>
        <p className="mt-1 text-sm text-muted">
          Browse the full range and jump straight to a sub-category.
        </p>
      </div>

      {categories.length === 0 ? (
        <EmptyState
          icon={<Layers className="size-12" aria-hidden />}
          title="No categories yet"
          subtitle="Check back soon — the catalogue is being set up."
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-5">
          {categories.map((category) => (
            <CategoryDirectoryCard key={category.id} category={category} />
          ))}
        </div>
      )}

      <script
        type="application/ld+json"
        // Safe: every value is our own category name/id from Firestore, never user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(categoryItemListSchema(categories)) }}
      />
    </main>
  );
}

/**
 * One category tile: image + name link to the listing, its sub-category names as separate,
 * independently-clickable pills beneath (`?sub=<name>` — see the comment on the pill `<Link>` below).
 *
 * WHY this is a page-local component rather than the shared `CategoryCard`: `CategoryCard`
 * (`src/components/catalog/CategoryCard.tsx`, read-only for this batch) wraps the ENTIRE tile in one
 * `<Link>`, which is correct for the home strip (the whole card is one destination) but cannot also
 * host a second, independently-clickable link per sub-category pill — nesting an `<a>` inside an
 * `<a>` is invalid HTML, and browsers only keep the outer one active. This page needs both a card
 * click AND a pill click that carries an extra query param, so the split markup lives here instead of
 * reshaping a component the home strip already depends on.
 */
function CategoryDirectoryCard({ category }: { category: CategoryProps }) {
  const href = `/category/${encodeURIComponent(category.name)}`;
  const hasSubCategories = category.subCategoryNames.length > 0;

  return (
    <div className="group overflow-hidden rounded-2xl border border-border bg-surface transition hover:border-border-strong hover:shadow-md">
      <Link
        href={href}
        className="block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-subtle">
          {category.image ? (
            <Image
              src={category.image}
              alt={category.name}
              fill
              sizes="(max-width: 768px) 50vw, 25vw"
              className="object-cover transition group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-faint" aria-hidden>
              <Layers size={28} />
            </div>
          )}
        </div>
        <div className={hasSubCategories ? 'px-4 pt-4 pb-2' : 'p-4'}>
          <div className="truncate font-display text-base font-semibold text-foreground">
            {category.name}
          </div>
        </div>
      </Link>

      {/*
        Sub-category pills — each is ITS OWN link (not nested inside the card <Link> above) so it can
        carry `?sub=<name>` independently of the card's plain category link. The listing page
        (`/category/[categoryName]`) is told to accept `sub=<name>,<name>` in its searchParams
        contract; a single pill click sends exactly one name.
      */}
      {hasSubCategories && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-4">
          {category.subCategoryNames.map((sub) => (
            <Link
              key={sub}
              href={`${href}?sub=${encodeURIComponent(sub)}`}
              className="rounded-full border border-border-strong bg-subtle px-2.5 py-1 text-[11px] font-semibold text-muted transition hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {sub}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
