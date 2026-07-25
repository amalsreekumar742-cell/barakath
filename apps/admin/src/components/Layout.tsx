import { Suspense, type FC } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import PageSkeleton from './PageSkeleton';

/**
 * Layout — the admin shell (spec §1.2, §1.22; design: enterprise density, warm off-white canvas).
 * Fixed 236px sidebar + a main column with a fixed 60px top bar over a scrollable content area.
 *
 * WHY the content area scrolls (not the whole page): sidebar + top bar stay pinned while only page
 *   content scrolls — standard dashboard ergonomics.
 * WHY Suspense/PageSkeleton: routes are lazy-loaded; the skeleton fills the content area while a route
 *   chunk loads (design: skeletons for all loading states).
 */
const Layout: FC = () => {
  return (
    <div className="flex h-screen overflow-hidden bg-app text-foreground">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 overflow-y-auto">
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
};

export default Layout;
