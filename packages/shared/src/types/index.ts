/**
 * Shared domain types (XxxProps) — Product, Order, Category, SubAdmin, etc.
 *
 * WHY here (not per-app): both TS/React apps and the Cloud Functions consume the same Firestore
 * documents. Defining `ProductProps`/`OrderProps` once means the shape can never drift between apps.
 *
 * Date/time fields use the Firestore `Timestamp` type (never a plain epoch `number`).
 */

export type { SubAdminProps } from './subAdmin';
export type {
  OrderProps,
  OrderItemProps,
  OrderShippingAddress,
  OrderStatusTimelineEntry,
} from './order';
export type { ProductProps, VariantProps, SpecificationProps } from './product';
export type { VariantCostProps, OrderCostProps, OrderCostLine } from './cost';
export type { CategoryProps } from './category';
export type { SubCategoryProps } from './subCategory';
export type { StockAdjustmentProps } from './stockAdjustment';
export type {
  GeneralSettingsProps,
  ColorUnit,
  VariantGroup,
  VariablesSettings,
  DeliverySettings,
  PaymentSettings,
  PrivacySettings,
  TermsSettings,
  ContactUsSettings,
} from './general';
export type { UserProps, UserAddressProps } from './user';
export type { WalletTransactionProps } from './wallet';
export type { AffiliateTransactionProps, AffiliateWithdrawalProps, BankAccountProps } from './affiliate';
export type { PaymentProps } from './payment';
export type { ReplacementProps } from './replacement';
export type { ReviewProps } from './review';
export type { CouponProps } from './coupon';
export type { SpinnerCampaignProps, SpinnerSlotProps, SpinHistoryProps } from './spinnerCampaign';
export type { BannerProps } from './banner';
export type { FlashSaleProps, FlashSaleVariantPrice, FlashSaleProduct } from './flashSale';
export type { AffiliateProductCommission } from './affiliateConfig';
export type { NotificationProps } from './notification';
