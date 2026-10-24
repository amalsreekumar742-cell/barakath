import { type FC, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import type { AppUpdateSettings, GeneralSettingsProps } from '@barakath/shared/types';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import Icon from '@/components/icons/Icon';
import ConfirmDialog from '@/components/ConfirmDialog';
import { updateAppUpdate } from '../api/updateSettings';
import { compareVersions, isValidVersion } from '../utils/appVersion';
import { Field, SaveButton, SettingsCard, inputCls } from './ui';

interface Props {
  settings: GeneralSettingsProps;
  onDirtyChange: (dirty: boolean) => void;
}

const toForm = (s: GeneralSettingsProps): AppUpdateSettings => ({ ...s.appUpdate });

type Platform = 'android' | 'ios';

const PLATFORMS: { key: Platform; title: string; storeName: string; storeHint: string; placeholder: string }[] = [
  {
    key: 'android',
    title: 'Android',
    storeName: 'Play Store',
    storeHint: 'The app’s Play Store listing.',
    placeholder: 'https://play.google.com/store/apps/details?id=com.barakath.barakath',
  },
  {
    key: 'ios',
    title: 'iOS',
    storeName: 'App Store',
    storeHint: 'App Store Connect → App Information → “View on App Store”.',
    placeholder: 'https://apps.apple.com/app/id0000000000',
  },
];

/** The three fields of one platform, keyed into the flat `appUpdate` map. */
const fieldsOf = (p: Platform) =>
  ({
    min: `${p}MinVersion`,
    latest: `${p}LatestVersion`,
    url: `${p}StoreUrl`,
  }) as const satisfies Record<string, keyof AppUpdateSettings>;

/** First validation problem for one platform, or null. */
function problemFor(form: AppUpdateSettings, p: (typeof PLATFORMS)[number]): string | null {
  const f = fieldsOf(p.key);
  const min = form[f.min].trim();
  const latest = form[f.latest].trim();
  const url = form[f.url].trim();
  if (min && !isValidVersion(min)) return `${p.title}: minimum version must look like 1.0.2`;
  if (latest && !isValidVersion(latest)) return `${p.title}: latest version must look like 1.0.2`;
  if (min && latest && compareVersions(min, latest) > 0)
    return `${p.title}: minimum version can’t be higher than the latest version`;
  if ((min || latest) && !url) return `${p.title}: add the ${p.storeName} link so “Update” has somewhere to go`;
  if (url && !/^https:\/\/\S+$/.test(url)) return `${p.title}: the ${p.storeName} link must start with https://`;
  return null;
}

/**
 * App Update tab — the customer app's update gate (spec §2.1 / §2.25 "Force update mechanism").
 *
 * Writes `general/config.appUpdate`, which the app's splash screen reads before sign-in. Per
 * platform: installs below the MINIMUM are blocked behind "Update required"; installs below the
 * LATEST get a dismissible "Update available" once per release. Blank versions turn both off.
 * Android and iOS are separate because the stores release independently — raise iOS only once the
 * build is live on the App Store, or iPhone customers get blocked with nothing to update to.
 */
const AppUpdateTab: FC<Props> = ({ settings, onDirtyChange }) => {
  const dispatch = useAppDispatch();
  const { saveLoading } = useAppSelector((s) => s.settings);
  const [form, setForm] = useState<AppUpdateSettings>(() => toForm(settings));
  const [confirmOpen, setConfirmOpen] = useState(false);

  const dirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(toForm(settings)),
    [form, settings],
  );
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const set = (k: keyof AppUpdateSettings, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // A raised minimum blocks real customers, so the confirm dialog names it explicitly.
  const raisedMinimums = PLATFORMS.filter((p) => {
    const k = fieldsOf(p.key).min;
    const next = form[k].trim();
    const prev = settings.appUpdate[k].trim();
    return next && (!prev || compareVersions(next, prev) > 0);
  }).map((p) => `${p.title} ${form[fieldsOf(p.key).min].trim()}`);

  const requestSave = () => {
    for (const p of PLATFORMS) {
      const problem = problemFor(form, p);
      if (problem) return toast.error(problem);
    }
    setConfirmOpen(true);
  };

  const doSave = async () => {
    const trimmed = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, v.trim()]),
    ) as AppUpdateSettings;
    const res = await dispatch(updateAppUpdate(trimmed));
    setConfirmOpen(false);
    if (updateAppUpdate.fulfilled.match(res)) toast.success('App update settings saved');
    else toast.error((res.payload as string) ?? 'Could not save app update settings');
  };

  return (
    <SettingsCard
      title="App Update"
      description="Prompt customers on old versions of the mobile app to update."
    >
      <div className="mb-5 flex gap-3 rounded-lg border border-gold-border bg-gold-subtle px-4 py-3">
        <Icon name="AlertLine" size={18} className="mt-0.5 shrink-0 text-gold-strong" />
        <p className="text-[13px] leading-normal text-foreground">
          Below the <span className="font-semibold">minimum version</span> the app is blocked until the
          customer updates. Below the <span className="font-semibold">latest version</span> they see an
          “Update available” prompt they can skip, once per release. Only raise a version after that build
          is live on its store. Leave a version blank to turn it off.
        </p>
      </div>

      <div className="space-y-6">
        {PLATFORMS.map((p) => {
          const f = fieldsOf(p.key);
          return (
            <div key={p.key}>
              <p className="mb-3 text-[14px] font-semibold text-foreground">{p.title}</p>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Minimum version" hint="Older installs must update to continue.">
                  <input
                    className={inputCls}
                    inputMode="decimal"
                    placeholder="e.g. 1.0.0"
                    value={form[f.min]}
                    onChange={(e) => set(f.min, e.target.value)}
                  />
                </Field>
                <Field label="Latest version" hint="Older installs see an optional prompt.">
                  <input
                    className={inputCls}
                    inputMode="decimal"
                    placeholder="e.g. 1.0.2"
                    value={form[f.latest]}
                    onChange={(e) => set(f.latest, e.target.value)}
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field label={`${p.storeName} link`} hint={p.storeHint}>
                    <input
                      type="url"
                      className={inputCls}
                      placeholder={p.placeholder}
                      value={form[f.url]}
                      onChange={(e) => set(f.url, e.target.value)}
                    />
                  </Field>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex justify-end">
        <SaveButton onClick={requestSave} loading={saveLoading} disabled={!dirty} />
      </div>

      <ConfirmDialog
        isOpen={confirmOpen}
        title="Save app update settings?"
        message={
          raisedMinimums.length
            ? `Customers on versions below ${raisedMinimums.join(' / ')} will be blocked until they update. Continue?`
            : 'Customers will see these update prompts the next time they open the app. Continue?'
        }
        confirmLabel="Save"
        loading={saveLoading}
        onConfirm={doSave}
        onCancel={() => setConfirmOpen(false)}
      />
    </SettingsCard>
  );
};

export default AppUpdateTab;
