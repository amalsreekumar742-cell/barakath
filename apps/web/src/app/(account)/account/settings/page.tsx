'use client';

import Link from 'next/link';
import type { UserProps } from '@barakath/shared';
import { AccountPageHeader } from '@/features/account/components/AccountPageHeader';
import { SkeletonText } from '@/components/Skeleton';
import { useAppSelector } from '@/stores/store';
import { PersonalInfoForm } from './PersonalInfoForm';
import { DangerZone } from './DangerZone';

/**
 * /account/settings (spec 3.19) — Personal info (editable), Legal (links only), Danger zone (delete
 * account). `noindex` is inherited from `(account)/layout.tsx`'s `metadata.robots` — not re-declared.
 *
 * NOTE on the profile-photo asymmetry: the account sidebar (`AccountSidebar.tsx`) already displays
 * `users/{uid}.profileImage` when present, but spec 3.19 lists no photo-upload control for the website
 * and none is added here — a photo can only ever arrive via the app. Flagged per this batch's brief.
 */
export default function SettingsPage() {
  const uid = useAppSelector((s) => s.auth.uid);
  const user = useAppSelector((s) => s.auth.user);
  const authLoading = useAppSelector((s) => s.auth.authLoading);

  const ready = !authLoading && !!uid && !!user;

  return (
    <div>
      {/* showBack: this page has no Breadcrumb, so the header is the only place a mobile back can go. */}
      <AccountPageHeader title="Settings" subtitle="Manage your profile and account." showBack />

      {!ready ? (
        <SettingsSkeleton />
      ) : (
        <div className="space-y-6">
          <PersonalInfoForm uid={uid} user={user as UserProps & { whatsapp?: string }} />

          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="font-display text-lg font-semibold text-foreground">Legal</h2>
            <div className="mt-3 flex flex-col gap-2 text-sm font-medium text-primary">
              <Link href="/privacy-policy" className="hover:underline">
                Privacy Policy
              </Link>
              <Link href="/terms" className="hover:underline">
                Terms &amp; Conditions
              </Link>
            </div>
          </div>

          <DangerZone uid={uid} />
        </div>
      )}
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="rounded-xl border border-border bg-surface p-5">
        <SkeletonText width="w-1/4" />
        <SkeletonText width="w-full" className="mt-4" />
        <SkeletonText width="w-full" className="mt-3" />
        <SkeletonText width="w-full" className="mt-3" />
      </div>
      <div className="rounded-xl border border-border bg-surface p-5">
        <SkeletonText width="w-1/5" />
        <SkeletonText width="w-1/3" className="mt-3" />
      </div>
    </div>
  );
}
