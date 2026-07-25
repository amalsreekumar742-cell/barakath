import type { SpecificationProps } from '@barakath/shared';

/** The two-column specifications table (spec §3.7), from `product.specifications: {key,value}[]`. */
export function SpecificationsTable({ specifications }: { specifications: SpecificationProps[] }) {
  if (specifications.length === 0) return null;

  return (
    <section>
      <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">
        Specifications
      </h2>
      <dl className="mt-4 divide-y divide-border overflow-hidden rounded-lg border border-border">
        {specifications.map((spec, i) => (
          <div key={`${spec.key}-${i}`} className="grid grid-cols-2 gap-4 bg-surface px-4 py-3 odd:bg-subtle">
            <dt className="text-sm font-medium text-foreground">{spec.key}</dt>
            <dd className="text-sm text-muted">{spec.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
