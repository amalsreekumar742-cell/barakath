import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '@/stores/store';
import { setActiveTab } from '../stores/settingsSlice';
import { SETTINGS_PATH, SettingsTab } from '../utils/settingsNav';

/**
 * Returns a callback that leaves the policy editor for `/settings` with the Policies tab open.
 *
 * WHY set the tab BEFORE navigating: `/settings` is one route whose visible tab is `activeTab` in Redux,
 * not a URL segment — navigating alone would land the admin on whatever tab was last open (often
 * Variables), away from the list they just edited.
 */
export function useBackToPolicies(): () => void {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  return useCallback(() => {
    dispatch(setActiveTab(SettingsTab.POLICIES));
    navigate(SETTINGS_PATH);
  }, [dispatch, navigate]);
}
