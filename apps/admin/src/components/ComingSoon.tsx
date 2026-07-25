import type { FC } from 'react';
import Icon from './icons/Icon';

/**
 * ComingSoon — placeholder page body for routes whose real feature isn't built yet.
 *
 * WHY one shared placeholder (lazy-loaded): every protected route needs SOMETHING to render now; a
 * single lazy component keeps the router wired end-to-end (guard → layout → page) and demonstrates the
 * code-split pattern each real feature page will follow. The title comes from the route config.
 */
const ComingSoon: FC<{ title?: string }> = ({ title }) => {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary-subtle text-primary">
        <Icon name="ToolsLine" size={28} />
      </div>
      {title && <h1 className="mt-4 text-[22px] font-bold tracking-tight text-foreground">{title}</h1>}
      <p className="mt-1 text-[14px] text-muted">Coming soon</p>
    </div>
  );
};

export default ComingSoon;
