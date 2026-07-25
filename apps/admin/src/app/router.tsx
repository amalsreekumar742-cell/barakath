import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, RouterProvider, Outlet, Navigate } from 'react-router-dom';
import { navItems } from '@/config/navigation';
import { useCurrentAdmin } from '@/hooks/useCurrentAdmin';
import RouteGuard from '@/features/auth/components/RouteGuard';
import Layout from '@/components/Layout';
import PageSkeleton from '@/components/PageSkeleton';

// WHY lazy: every route is code-split so the initial bundle stays small (skill rule 13). Public auth
// pages and the shared placeholder each load on demand; real feature pages follow the same pattern.
const LoginPage = lazy(() => import('@/features/auth/components/LoginPage'));
const ForgotPasswordPage = lazy(() => import('@/features/auth/components/ForgotPasswordPage'));
const ComingSoon = lazy(() => import('@/components/ComingSoon'));

// Built feature pages (each its own code-split chunk).
const DashboardPage = lazy(() => import('@/features/dashboard/components/DashboardPage'));
const CategoriesPage = lazy(() => import('@/features/categories/components/CategoriesPage'));
const SubCategoriesPage = lazy(() => import('@/features/categories/components/SubCategoriesPage'));
const AddEditCategoryPage = lazy(
  () => import('@/features/categories/components/AddEditCategoryPage'),
);
const ProductsPage = lazy(() => import('@/features/products/components/ProductsPage'));
const ProductFormPage = lazy(() => import('@/features/products/components/ProductFormPage'));
const InventoryPage = lazy(() => import('@/features/inventory/components/InventoryPage'));
const AdjustStockPage = lazy(() => import('@/features/inventory/components/AdjustStockPage'));
const OrdersPage = lazy(() => import('@/features/orders/components/OrdersPage'));
const OrderDetailPage = lazy(() => import('@/features/orders/components/OrderDetailPage'));
const CustomersPage = lazy(() => import('@/features/customers/components/CustomersPage'));
const CustomerDetailPage = lazy(() => import('@/features/customers/components/CustomerDetailPage'));
const PaymentsPage = lazy(() => import('@/features/payments/components/PaymentsPage'));
const ReplacementPage = lazy(() => import('@/features/replacement/components/ReplacementPage'));
const ReplacementDetailPage = lazy(
  () => import('@/features/replacement/components/ReplacementDetailPage'),
);
const ReviewsPage = lazy(() => import('@/features/reviews/components/ReviewsPage'));
const CouponsPage = lazy(() => import('@/features/coupons/components/CouponsPage'));
const CreateCouponPage = lazy(() => import('@/features/coupons/components/CreateCouponPage'));
const EditCouponPage = lazy(() => import('@/features/coupons/components/EditCouponPage'));
const SpinnerCampaignsPage = lazy(
  () => import('@/features/spinnerCampaigns/components/SpinnerCampaignsPage'),
);
const CreateCampaignPage = lazy(
  () => import('@/features/spinnerCampaigns/components/CreateCampaignPage'),
);
const CampaignDetailPage = lazy(
  () => import('@/features/spinnerCampaigns/components/CampaignDetailPage'),
);
const AffiliatePage = lazy(() => import('@/features/affiliate/components/AffiliatePage'));
const AllocateAffiliatePage = lazy(
  () => import('@/features/affiliate/components/AllocateAffiliatePage'),
);
const BannersPage = lazy(() => import('@/features/banners/components/BannersPage'));
const AddBannerPage = lazy(() => import('@/features/banners/components/AddBannerPage'));
const EditBannerPage = lazy(() => import('@/features/banners/components/EditBannerPage'));
const FlashSalePage = lazy(() => import('@/features/flashSale/components/FlashSalePage'));
const CreateFlashSalePage = lazy(
  () => import('@/features/flashSale/components/CreateFlashSalePage'),
);
const NewArrivalsPage = lazy(() => import('@/features/newArrivals/components/NewArrivalsPage'));
const AddNewArrivalsPage = lazy(
  () => import('@/features/newArrivals/components/AddNewArrivalsPage'),
);
const NotificationsPage = lazy(
  () => import('@/features/notifications/components/NotificationsPage'),
);
const CreateNotificationPage = lazy(
  () => import('@/features/notifications/components/CreateNotificationPage'),
);
const ReportsPage = lazy(() => import('@/features/reports/components/ReportsPage'));
const SubAdminPage = lazy(() => import('@/features/subAdmin/components/SubAdminPage'));
const CreateSubAdminPage = lazy(
  () => import('@/features/subAdmin/components/CreateSubAdminPage'),
);
const EditSubAdminPage = lazy(() => import('@/features/subAdmin/components/EditSubAdminPage'));
const SettingsPage = lazy(() => import('@/features/settings/components/SettingsPage'));

// Real element per built path; everything else falls back to the "Coming soon" placeholder.
const BUILT: Record<string, ReactNode> = {
  '/': <DashboardPage />,
  '/categories': <CategoriesPage />,
  '/products': <ProductsPage />,
  '/inventory': <InventoryPage />,
  '/orders': <OrdersPage />,
  '/customers': <CustomersPage />,
  '/payments': <PaymentsPage />,
  '/replacement': <ReplacementPage />,
  '/reviews': <ReviewsPage />,
  '/coupons': <CouponsPage />,
  '/spinner-campaigns': <SpinnerCampaignsPage />,
  '/affiliate': <AffiliatePage />,
  '/banners': <BannersPage />,
  '/flash-sale': <FlashSalePage />,
  '/new-arrivals': <NewArrivalsPage />,
  '/notifications': <NotificationsPage />,
  '/reports': <ReportsPage />,
  '/sub-admin': <SubAdminPage />,
  '/settings': <SettingsPage />,
};

/**
 * AppRoot — the router's root element. Mounts the app-wide current-admin listener ONCE (per the skill:
 * subscribe to the signed-in user's own document high in the tree) and renders the matched route.
 * WHY the outer Suspense: the child route elements are lazy; this boundary shows a skeleton while a
 * chunk loads (the protected Layout adds its own inner Suspense for page content).
 */
function AppRoot() {
  useCurrentAdmin();
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Outlet />
    </Suspense>
  );
}

/**
 * Protected route table — generated from the nav config so the sidebar and the router never drift.
 * Dashboard ("/") is the index route; every other nav item becomes a child path. All are placeholders
 * ("Coming soon") until their feature is built.
 */
const protectedChildren = [
  ...navItems.map((item) =>
    item.path === '/'
      ? { index: true as const, element: BUILT['/'] ?? <ComingSoon title="Dashboard" /> }
      : {
          path: item.path.slice(1),
          element: BUILT[item.path] ?? <ComingSoon title={item.label} />,
        },
  ),
  // Nested category routes (not sidebar items). Static 'add' outranks the dynamic ':id'.
  { path: 'categories/add', element: <AddEditCategoryPage /> },
  { path: 'categories/:id/edit', element: <AddEditCategoryPage /> },
  { path: 'categories/:id', element: <SubCategoriesPage /> },
  // Nested product routes.
  { path: 'products/add', element: <ProductFormPage /> },
  { path: 'products/:id/edit', element: <ProductFormPage /> },
  // Order detail (not a sidebar item).
  { path: 'orders/:id', element: <OrderDetailPage /> },
  // Customer detail (not a sidebar item).
  { path: 'customers/:id', element: <CustomerDetailPage /> },
  // Replacement detail (not a sidebar item).
  { path: 'replacement/:id', element: <ReplacementDetailPage /> },
  // Coupon create/edit (not sidebar items). Static 'create' outranks the dynamic ':id/edit'.
  { path: 'coupons/create', element: <CreateCouponPage /> },
  { path: 'coupons/:id/edit', element: <EditCouponPage /> },
  // Spinner campaign create/detail. Static 'create' outranks the dynamic ':id' (create also serves edit via ?edit=).
  { path: 'spinner-campaigns/create', element: <CreateCampaignPage /> },
  { path: 'spinner-campaigns/:id', element: <CampaignDetailPage /> },
  // Affiliate allocate (not a sidebar item).
  { path: 'affiliate/allocate', element: <AllocateAffiliatePage /> },
  // Banner add/edit. Static 'add' outranks the dynamic ':id/edit'.
  { path: 'banners/add', element: <AddBannerPage /> },
  { path: 'banners/:id/edit', element: <EditBannerPage /> },
  // Flash sale create (not a sidebar item).
  { path: 'flash-sale/create', element: <CreateFlashSalePage /> },
  // New arrivals add (not a sidebar item).
  { path: 'new-arrivals/add', element: <AddNewArrivalsPage /> },
  // Notification create (not a sidebar item).
  { path: 'notifications/create', element: <CreateNotificationPage /> },
  // Sub admin create/edit. Static 'create' outranks the dynamic ':id/edit'.
  { path: 'sub-admin/create', element: <CreateSubAdminPage /> },
  { path: 'sub-admin/:id/edit', element: <EditSubAdminPage /> },
  // Adjust stock (not a sidebar item).
  { path: 'inventory/adjust', element: <AdjustStockPage /> },
];

const router = createBrowserRouter([
  {
    element: <AppRoot />,
    children: [
      // Public routes
      { path: '/login', element: <LoginPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },

      // Protected routes: guard -> layout shell -> page
      {
        element: (
          <RouteGuard>
            <Layout />
          </RouteGuard>
        ),
        children: protectedChildren,
      },

      // Unknown path -> home (the guard then decides authed vs. /login).
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}
