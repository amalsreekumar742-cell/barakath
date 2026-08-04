import type { Metadata } from 'next';
import { ProfileScreen } from '@/features/account/components/ProfileScreen';

/**
 * /account — the Profile tab's destination.
 *
 * WHY this route was added: the mobile bottom nav's fifth tab needs a root to land on, and until now
 * `/account` had only children (`/account/orders`, `/account/wallet`, …) and no index — the URL 404'd.
 * It doubles as the account landing page on desktop, where previously arriving at /account showed
 * nothing.
 *
 * On mobile this is the app's Profile screen and also carries the links the (now desktop-only)
 * footer used to provide — help, privacy policy and terms — so nothing became unreachable on a phone.
 */
export const metadata: Metadata = {
  title: 'Profile',
};

export default function AccountPage() {
  return <ProfileScreen />;
}
