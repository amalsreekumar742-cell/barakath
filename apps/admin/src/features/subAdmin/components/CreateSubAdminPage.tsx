import type { FC } from 'react';
import SubAdminForm from './SubAdminForm';

/**
 * CreateSubAdminPage — route /sub-admin/create (spec §1.20 Create Sub Admin). Thin wrapper that renders
 * the shared SubAdminForm in "create" mode; all field/validation/permission logic lives in the form so
 * Create and Edit stay identical.
 */
const CreateSubAdminPage: FC = () => <SubAdminForm mode="create" />;

export default CreateSubAdminPage;
