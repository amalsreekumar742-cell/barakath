import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { ProductProps, VariantProps, CategoryProps } from '@barakath/shared/types';
import { fetchProducts } from '../api/fetchProducts';
import { fetchProductDetail } from '../api/fetchProductDetail';
import { fetchCategoriesForFilter } from '../api/fetchCategoriesForFilter';
import { createProduct } from '../api/createProduct';
import { updateProduct } from '../api/updateProduct';
import { deleteProduct } from '../api/deleteProduct';
import { exportProductsCSV } from '../api/exportProductsCSV';
import type { ProductFilters } from '../types';

/**
 * productsSlice — list + filters + detail + CRUD state (spec §1.5).
 *
 * WHY filters live in the slice and mutating them clears the list: the list is a cursor-paginated view
 * of the CURRENT filters, so changing any filter must reset `products`/`lastVisible`/`hasMore` and
 * refetch from page one (the component reacts to the filter change). Each list append dedups by id.
 */
interface ProductsState {
  products: ProductProps[];
  lastVisible: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- Firestore cursor
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;

  filters: ProductFilters;

  productDetail: { product: ProductProps; variants: VariantProps[] } | null;
  detailLoading: boolean;
  detailError: string | null;

  filterCategories: CategoryProps[];
  filterCategoriesLoading: boolean;

  createLoading: boolean;
  updateLoading: boolean;
  deleteLoading: boolean;
  exportLoading: boolean;
}

const initialState: ProductsState = {
  products: [],
  lastVisible: null,
  hasMore: false,
  loading: false,
  loadingMore: false,
  error: null,
  filters: {},
  productDetail: null,
  detailLoading: false,
  detailError: null,
  filterCategories: [],
  filterCategoriesLoading: false,
  createLoading: false,
  updateLoading: false,
  deleteLoading: false,
  exportLoading: false,
};

const resetList = (s: ProductsState) => {
  s.products = [];
  s.lastVisible = null;
  s.hasMore = false;
};

const productsSlice = createSlice({
  name: 'products',
  initialState,
  reducers: {
    setFilters(s, a: PayloadAction<Partial<ProductFilters>>) {
      s.filters = { ...s.filters, ...a.payload };
      resetList(s);
    },
    clearFilters(s) {
      // Keep the search term (it lives in its own field); clear the panel filters.
      s.filters = { searchTerm: s.filters.searchTerm };
      resetList(s);
    },
    setSearchTerm(s, a: PayloadAction<string>) {
      s.filters.searchTerm = a.payload || undefined;
      resetList(s);
    },
    resetProductDetail(s) {
      s.productDetail = null;
      s.detailError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // --- list ---
      .addCase(fetchProducts.pending, (s, a) => {
        if (a.meta.arg.cursor) s.loadingMore = true;
        else {
          s.loading = true;
          s.error = null;
        }
      })
      .addCase(fetchProducts.fulfilled, (s, a) => {
        const isFirst = !a.meta.arg.cursor;
        s.loading = false;
        s.loadingMore = false;
        const seen = new Set(s.products.map((p) => p.id));
        const fresh = a.payload.items.filter((p) => !seen.has(p.id));
        s.products = isFirst ? a.payload.items : [...s.products, ...fresh];
        s.lastVisible = a.payload.lastVisible;
        s.hasMore = a.payload.hasMore;
      })
      .addCase(fetchProducts.rejected, (s, a) => {
        s.loading = false;
        s.loadingMore = false;
        s.error = a.payload ?? 'Failed to load products';
      })

      // --- detail ---
      .addCase(fetchProductDetail.pending, (s) => {
        s.detailLoading = true;
        s.detailError = null;
      })
      .addCase(fetchProductDetail.fulfilled, (s, a) => {
        s.detailLoading = false;
        s.productDetail = a.payload;
      })
      .addCase(fetchProductDetail.rejected, (s, a) => {
        s.detailLoading = false;
        s.detailError = a.payload ?? 'Failed to load product';
      })

      // --- filter categories ---
      .addCase(fetchCategoriesForFilter.pending, (s) => {
        s.filterCategoriesLoading = true;
      })
      .addCase(fetchCategoriesForFilter.fulfilled, (s, a) => {
        s.filterCategoriesLoading = false;
        s.filterCategories = a.payload;
      })
      .addCase(fetchCategoriesForFilter.rejected, (s) => {
        s.filterCategoriesLoading = false;
      })

      // --- create ---
      .addCase(createProduct.pending, (s) => {
        s.createLoading = true;
      })
      .addCase(createProduct.fulfilled, (s) => {
        s.createLoading = false;
      })
      .addCase(createProduct.rejected, (s) => {
        s.createLoading = false;
      })

      // --- update ---
      .addCase(updateProduct.pending, (s) => {
        s.updateLoading = true;
      })
      .addCase(updateProduct.fulfilled, (s, a) => {
        s.updateLoading = false;
        const i = s.products.findIndex((p) => p.id === a.payload.product.id);
        if (i !== -1) s.products[i] = a.payload.product;
        s.productDetail = a.payload;
      })
      .addCase(updateProduct.rejected, (s) => {
        s.updateLoading = false;
      })

      // --- delete ---
      .addCase(deleteProduct.pending, (s) => {
        s.deleteLoading = true;
      })
      .addCase(deleteProduct.fulfilled, (s, a) => {
        s.deleteLoading = false;
        s.products = s.products.filter((p) => p.id !== a.payload);
      })
      .addCase(deleteProduct.rejected, (s) => {
        s.deleteLoading = false;
      })

      // --- export ---
      .addCase(exportProductsCSV.pending, (s) => {
        s.exportLoading = true;
      })
      .addCase(exportProductsCSV.fulfilled, (s) => {
        s.exportLoading = false;
      })
      .addCase(exportProductsCSV.rejected, (s) => {
        s.exportLoading = false;
      });
  },
});

export const { setFilters, clearFilters, setSearchTerm, resetProductDetail } =
  productsSlice.actions;
export default productsSlice.reducer;
