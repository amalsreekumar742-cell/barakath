import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import type { TypedUseSelectorHook } from 'react-redux';
import authReducer from '@/features/auth/stores/authSlice';
import dashboardReducer from '@/features/dashboard/stores/dashboardSlice';
import categoriesReducer from '@/features/categories/stores/categoriesSlice';
import productsReducer from '@/features/products/stores/productsSlice';
import inventoryReducer from '@/features/inventory/stores/inventorySlice';
import ordersReducer from '@/features/orders/stores/ordersSlice';
import customersReducer from '@/features/customers/stores/customersSlice';
import paymentsReducer from '@/features/payments/stores/paymentsSlice';
import replacementReducer from '@/features/replacement/stores/replacementSlice';
import reviewsReducer from '@/features/reviews/stores/reviewsSlice';
import couponsReducer from '@/features/coupons/stores/couponsSlice';
import spinnerCampaignsReducer from '@/features/spinnerCampaigns/stores/spinnerCampaignsSlice';
import affiliateReducer from '@/features/affiliate/stores/affiliateSlice';
import bannersReducer from '@/features/banners/stores/bannersSlice';
import flashSaleReducer from '@/features/flashSale/stores/flashSaleSlice';
import newArrivalsReducer from '@/features/newArrivals/stores/newArrivalsSlice';
import notificationsReducer from '@/features/notifications/stores/notificationsSlice';
import reportsReducer from '@/features/reports/stores/reportsSlice';
import subAdminReducer from '@/features/subAdmin/stores/subAdminSlice';
import settingsReducer from '@/features/settings/stores/settingsSlice';
import currentAdminReducer from './currentAdminSlice';

/**
 * The single Redux Toolkit store for the admin app.
 * WHY one store at the app root: RTK's store is the composition root — feature slices register here
 *   via `reducer`. App-wide slices (currentAdmin, ui, appConfig) also live under src/stores/.
 * WHY typed hooks: `useAppSelector`/`useAppDispatch` are typed to this store so selectors and
 *   dispatched thunks are fully type-checked — never use the untyped useSelector/useDispatch.
 */
export const store = configureStore({
  reducer: {
    // App-wide slices
    currentAdmin: currentAdminReducer,
    // Feature slices
    auth: authReducer,
    dashboard: dashboardReducer,
    categories: categoriesReducer,
    products: productsReducer,
    inventory: inventoryReducer,
    orders: ordersReducer,
    customers: customersReducer,
    payments: paymentsReducer,
    replacement: replacementReducer,
    reviews: reviewsReducer,
    coupons: couponsReducer,
    spinnerCampaigns: spinnerCampaignsReducer,
    affiliate: affiliateReducer,
    banners: bannersReducer,
    flashSale: flashSaleReducer,
    newArrivals: newArrivalsReducer,
    notifications: notificationsReducer,
    reports: reportsReducer,
    subAdmin: subAdminReducer,
    settings: settingsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
