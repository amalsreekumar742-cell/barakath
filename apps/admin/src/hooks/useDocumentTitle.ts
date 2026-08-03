import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { segmentToLabel } from '@/config/navigation';

/** Suffix on every page, so a tab is identifiable as this app among many open tabs. */
const APP_NAME = 'Barakath Admin';

/**
 * useDocumentTitle — keeps the browser tab title in step with the current route.
 *
 * WHY: `index.html` sets a single static `<title>Barakath Admin</title>`, so every page produced an
 * identical tab. With several admin tabs open (an order in one, a return in another) they were
 * indistinguishable. The title now leads with the section — "Returns · Barakath Admin".
 * WHY derived from the URL rather than set per page: same reasoning as `Breadcrumb`, and it reuses
 * that component's `segmentToLabel`, so renaming a nav label updates the sidebar, the breadcrumb and
 * the tab together. No page has to remember to set its own title.
 * WHY only the FIRST segment: a detail route (`/replacement/abc123`) would otherwise put a raw
 * document id in the tab, which is noise. The section name is what makes a tab findable.
 */
export function useDocumentTitle(): void {
  const { pathname } = useLocation();

  useEffect(() => {
    const [section] = pathname.split('/').filter(Boolean);
    document.title = section ? `${segmentToLabel(section)} · ${APP_NAME}` : `Dashboard · ${APP_NAME}`;
  }, [pathname]);
}

export default useDocumentTitle;
