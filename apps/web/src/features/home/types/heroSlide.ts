/**
 * HeroSlide — what the home hero carousel needs to paint one slide, already resolved server-side.
 *
 * WHY resolution happens before this type exists (not in the client carousel): `BannerProps` is a
 * single-link model (`linkType`/`linkValue`, see WEB_BATCH2_NOTES.md §F) with no attached-products
 * list, and a `linkType === 'Product'` banner whose product was deleted must render non-interactive
 * rather than link to a 404. That check needs a Firestore read (`getProductById`), which only a
 * Server Component can do — so `href` arrives here already decided, and the client carousel never
 * touches Firestore.
 */
export interface HeroSlide {
  id: string;
  /** Alt text / accessible label for the slide. */
  title: string;
  image: string;
  /**
   * Where the slide navigates to, or null when it has nothing to link to (linkType 'None', or a
   * 'Product' banner whose target no longer exists). A null href renders the slide non-interactive.
   */
  href: string | null;
}
