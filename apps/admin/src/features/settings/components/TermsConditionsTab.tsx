import type { FC } from 'react';
import type { GeneralSettingsProps } from '@barakath/shared/types';
import { useAppDispatch } from '@/stores/store';
import { updateTermsConditions } from '../api/updateSettings';
import LegalEditorTab from './LegalEditorTab';

interface Props {
  settings: GeneralSettingsProps;
  onDirtyChange: (dirty: boolean) => void;
}

/** Tab 5 — Terms & Conditions (spec §1.21). Thin wrapper over the shared legal editor. */
const TermsConditionsTab: FC<Props> = ({ settings, onDirtyChange }) => {
  const dispatch = useAppDispatch();
  const onSave = async (html: string) => {
    const res = await dispatch(updateTermsConditions({ termsAndConditions: html }));
    return updateTermsConditions.fulfilled.match(res);
  };
  return (
    <LegalEditorTab
      title="Terms & Conditions"
      description="Shown to customers in the app and website."
      value={settings.terms.termsAndConditions}
      updatedAt={settings.terms.termsUpdatedAt}
      onSave={onSave}
      onDirtyChange={onDirtyChange}
    />
  );
};

export default TermsConditionsTab;
