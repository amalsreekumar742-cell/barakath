import type { FC } from 'react';
import type { GeneralSettingsProps } from '@barakath/shared/types';
import { useAppDispatch } from '@/stores/store';
import { updatePrivacyPolicy } from '../api/updateSettings';
import LegalEditorTab from './LegalEditorTab';

interface Props {
  settings: GeneralSettingsProps;
  onDirtyChange: (dirty: boolean) => void;
}

/** Tab 4 — Privacy Policy (spec §1.21). Thin wrapper over the shared legal editor. */
const PrivacyPolicyTab: FC<Props> = ({ settings, onDirtyChange }) => {
  const dispatch = useAppDispatch();
  const onSave = async (html: string) => {
    const res = await dispatch(updatePrivacyPolicy({ privacyPolicy: html }));
    return updatePrivacyPolicy.fulfilled.match(res);
  };
  return (
    <LegalEditorTab
      title="Privacy Policy"
      description="Shown to customers in the app and website."
      value={settings.privacy.privacyPolicy}
      updatedAt={settings.privacy.privacyPolicyUpdatedAt}
      onSave={onSave}
      onDirtyChange={onDirtyChange}
    />
  );
};

export default PrivacyPolicyTab;
