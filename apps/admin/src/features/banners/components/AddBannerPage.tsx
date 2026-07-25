import type { FC } from 'react';
import BannerForm from './BannerForm';

/**
 * AddBannerPage — route /banners/add (spec §1.15 Add Banner). Thin wrapper that renders the shared
 * BannerForm in "create" mode; all field/validation/image logic lives in BannerForm so Add and Edit stay
 * identical.
 */
const AddBannerPage: FC = () => <BannerForm mode="create" />;

export default AddBannerPage;
