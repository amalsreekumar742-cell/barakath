'use client';

import Link from 'next/link';
import { Wallet } from 'lucide-react';

/** The wallet icon in the header nav (design marker 01/09/10 — Grid, Wallet, User, Bag). Routes into
 *  `/account/wallet`; `(account)/layout.tsx`'s middleware gate handles the signed-out case. */
export function WalletButton() {
  return (
    <Link
      href="/account/wallet"
      aria-label="Wallet"
      className="inline-flex size-10 items-center justify-center rounded-lg text-foreground hover:bg-subtle"
    >
      <Wallet className="size-[22px]" aria-hidden />
    </Link>
  );
}
