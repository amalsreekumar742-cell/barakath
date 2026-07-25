import type { FC } from 'react';
import CouponForm from './CouponForm';

/**
 * CreateCouponPage — route /coupons/create (spec §1.12 Create Coupon). Thin wrapper that renders the
 * shared CouponForm in "create" mode; all field/validation logic lives in CouponForm so Create and Edit
 * stay identical.
 */
const CreateCouponPage: FC = () => <CouponForm mode="create" />;

export default CreateCouponPage;
