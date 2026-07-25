'use client';

import { useRouter } from 'next/navigation';
import { Breadcrumb } from '@/components/Breadcrumb';
import { AccountPageHeader } from '@/features/account/components/AccountPageHeader';
import { AffiliateGuard } from '@/features/affiliate/components/AffiliateGuard';
import { WithdrawForm } from '@/features/affiliate/components/WithdrawForm';
import { useBankAccounts } from '@/features/affiliate/hooks/useBankAccounts';

/**
 * /account/affiliate-wallet/withdraw (spec §3.16, §2.22) — a direct-linkable page for the same
 * `WithdrawForm` the affiliate wallet page now also renders inline (design marker 24 shows "Withdraw
 * funds" as a panel on the wallet screen itself, not a separate page — the inline panel is the primary
 * entry point; this route stays as a working deep link / bookmark target using the identical form).
 * Guarded with `requireWalletAccess`: unlike the wallet dashboard, this page genuinely cannot be used
 * while admin has switched wallet access off.
 */
export default function WithdrawPage() {
  return (
    <div>
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Affiliate Wallet', href: '/account/affiliate-wallet' },
          { label: 'Withdraw' },
        ]}
      />
      <AccountPageHeader title="Complete withdrawal" subtitle="Request a payout to one of your saved bank accounts." />
      <AffiliateGuard requireWalletAccess>
        {(user) => (
          <WithdrawBody uid={user.id} userName={user.fullName} userPhone={user.phone} balance={user.affiliateBalance} />
        )}
      </AffiliateGuard>
    </div>
  );
}

function WithdrawBody({
  uid,
  userName,
  userPhone,
  balance,
}: {
  uid: string;
  userName: string;
  userPhone: string;
  balance: number;
}) {
  const router = useRouter();
  const bankAccounts = useBankAccounts(uid);

  return (
    <div className="max-w-xl">
      <WithdrawForm
        uid={uid}
        userName={userName}
        userPhone={userPhone}
        balance={balance}
        bankAccounts={bankAccounts}
        onSuccess={() => router.push('/account/affiliate-wallet')}
      />
    </div>
  );
}
