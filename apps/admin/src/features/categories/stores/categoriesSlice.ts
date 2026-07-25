import { createSlice } from '@reduxjs/toolkit';
import type { CategoryProps, SubCategoryProps } from '@barakath/shared/types';
import { fetchCategories } from '../api/fetchCategories';
import { fetchCategoryDetail } from '../api/fetchCategoryDetail';
import { fetchSubCategories } from '../api/fetchSubCategories';
import { fetchSubCategoryProducts } from '../api/fetchSubCategoryProducts';
import { createCategory } from '../api/createCategory';
import { updateCategory } from '../api/updateCategory';
import { deleteCategory } from '../api/deleteCategory';
import { deleteSubCategory } from '../api/deleteSubCategory';
import { addSubCategory } from '../api/addSubCategory';

/**
 * categoriesSlice — list + detail + CRUD state for categories and their sub-category documents (§1.4).
 *
 * WHY explicit named state per concern: the UI renders skeletons, load-more, and button-loading
 * independently, never inferring from null (skill). The list appends pages and dedups by id. Sub-
 * categories are their own docs (subcollection), held in `subCategories`; product counts are keyed by
 * sub-category id in `subCategoryProductCounts`.
 */
interface CategoriesState {
  categories: CategoryProps[];
  lastVisible: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- Firestore cursor
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;

  categoryDetail: CategoryProps | null;
  detailLoading: boolean;
  detailError: string | null;

  subCategories: SubCategoryProps[];
  subCategoriesLoading: boolean;
  subCategoryProductCounts: Record<string, number>; // keyed by subCategoryId

  createLoading: boolean;
  updateLoading: boolean;
  deleteLoading: boolean;
}

const initialState: CategoriesState = {
  categories: [],
  lastVisible: null,
  hasMore: false,
  loading: false,
  loadingMore: false,
  error: null,
  categoryDetail: null,
  detailLoading: false,
  detailError: null,
  subCategories: [],
  subCategoriesLoading: false,
  subCategoryProductCounts: {},
  createLoading: false,
  updateLoading: false,
  deleteLoading: false,
};

const categoriesSlice = createSlice({
  name: 'categories',
  initialState,
  reducers: {
    resetCategoryDetail(state) {
      state.categoryDetail = null;
      state.detailError = null;
      state.subCategories = [];
      state.subCategoryProductCounts = {};
    },
  },
  extraReducers: (builder) => {
    builder
      // --- list (paginated) ---
      .addCase(fetchCategories.pending, (s, a) => {
        if (a.meta.arg.cursor) s.loadingMore = true;
        else {
          s.loading = true;
          s.error = null;
        }
      })
      .addCase(fetchCategories.fulfilled, (s, a) => {
        const isFirst = !a.meta.arg.cursor;
        s.loading = false;
        s.loadingMore = false;
        const existing = new Set(s.categories.map((c) => c.id));
        const fresh = a.payload.items.filter((c) => !existing.has(c.id));
        s.categories = isFirst ? a.payload.items : [...s.categories, ...fresh];
        s.lastVisible = a.payload.lastVisible;
        s.hasMore = a.payload.hasMore;
      })
      .addCase(fetchCategories.rejected, (s, a) => {
        s.loading = false;
        s.loadingMore = false;
        s.error = a.payload ?? 'Failed to load categories';
      })

      // --- detail ---
      .addCase(fetchCategoryDetail.pending, (s) => {
        s.detailLoading = true;
        s.detailError = null;
      })
      .addCase(fetchCategoryDetail.fulfilled, (s, a) => {
        s.detailLoading = false;
        s.categoryDetail = a.payload;
      })
      .addCase(fetchCategoryDetail.rejected, (s, a) => {
        s.detailLoading = false;
        s.detailError = a.payload ?? 'Failed to load category';
      })

      // --- sub-category documents ---
      .addCase(fetchSubCategories.pending, (s) => {
        s.subCategoriesLoading = true;
      })
      .addCase(fetchSubCategories.fulfilled, (s, a) => {
        s.subCategoriesLoading = false;
        s.subCategories = a.payload;
      })
      .addCase(fetchSubCategories.rejected, (s) => {
        s.subCategoriesLoading = false;
      })
      .addCase(fetchSubCategoryProducts.fulfilled, (s, a) => {
        s.subCategoryProductCounts[a.payload.subCategoryId] = a.payload.count;
      })

      // --- create ---
      .addCase(createCategory.pending, (s) => {
        s.createLoading = true;
      })
      .addCase(createCategory.fulfilled, (s, a) => {
        s.createLoading = false;
        s.categories.unshift(a.payload);
      })
      .addCase(createCategory.rejected, (s) => {
        s.createLoading = false;
      })

      // --- update ---
      .addCase(updateCategory.pending, (s) => {
        s.updateLoading = true;
      })
      .addCase(updateCategory.fulfilled, (s, a) => {
        s.updateLoading = false;
        const i = s.categories.findIndex((c) => c.id === a.payload.id);
        if (i !== -1) s.categories[i] = a.payload;
        if (s.categoryDetail?.id === a.payload.id) s.categoryDetail = a.payload;
      })
      .addCase(updateCategory.rejected, (s) => {
        s.updateLoading = false;
      })

      // --- delete category ---
      .addCase(deleteCategory.pending, (s) => {
        s.deleteLoading = true;
      })
      .addCase(deleteCategory.fulfilled, (s, a) => {
        s.deleteLoading = false;
        s.categories = s.categories.filter((c) => c.id !== a.payload);
      })
      .addCase(deleteCategory.rejected, (s) => {
        s.deleteLoading = false;
      })

      // --- sub-category add / delete (keep list + detail + denormalized names in sync) ---
      .addCase(addSubCategory.fulfilled, (s, a) => {
        const { categoryId, subCategory } = a.payload;
        if (s.categoryDetail?.id === categoryId) s.subCategories.push(subCategory);
        const bump = (c: CategoryProps | null | undefined) => {
          if (c && c.id === categoryId && !c.subCategoryNames.includes(subCategory.name)) {
            c.subCategoryNames.push(subCategory.name);
          }
        };
        bump(s.categoryDetail);
        bump(s.categories.find((c) => c.id === categoryId));
      })
      .addCase(deleteSubCategory.fulfilled, (s, a) => {
        const { categoryId, subCategoryId, subCategoryName } = a.payload;
        s.subCategories = s.subCategories.filter((sc) => sc.id !== subCategoryId);
        delete s.subCategoryProductCounts[subCategoryId];
        const strip = (c: CategoryProps | null | undefined) => {
          if (c && c.id === categoryId) {
            c.subCategoryNames = c.subCategoryNames.filter((n) => n !== subCategoryName);
          }
        };
        strip(s.categoryDetail);
        strip(s.categories.find((c) => c.id === categoryId));
      });
  },
});

export const { resetCategoryDetail } = categoriesSlice.actions;
export default categoriesSlice.reducer;
