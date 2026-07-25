'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { PackageX } from 'lucide-react';
import { Breadcrumb } from '@/components/Breadcrumb';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonText } from '@/components/Skeleton';
import { useAppSelector } from '@/stores/store';
import { toastError, toastSuccess } from '@/lib/toast';
import { useOrder } from '@/features/orders/hooks/useOrder';
import { submitReplacement } from '@/features/orders/api/replacements';
import { PhotoUpload } from '@/features/orders/components/PhotoUpload';
import { money, orderReference } from '@/features/orders/utils/orderFormat';

/** The exact four spec 2.18 reason options — not the prototype's three (which drops "Quality not as
 *  expected"); the spec wins, matching `apps/app/lib/core/constants/domain_enums.dart`'s `ReplacementReason`. */
const REASONS = ['Item damaged/defective', 'Wrong item delivered', 'No longer needed', 'Quality not as expected'];

const MIN_DESCRIPTION_LENGTH = 10;
const MIN_PHOTOS = 1;
const MAX_PHOTOS = 5;

export default function RequestReplacementPage() {
  const router = useRouter();
  const { orderId } = useParams<{ orderId: string }>();
  const searchParams = useSearchParams();
  const productId = searchParams.get('productId') ?? '';
  const variantId = searchParams.get('variantId') ?? '';

  const uid = useAppSelector((s) => s.auth.uid);
  const user = useAppSelector((s) => s.auth.user);
  const authLoading = useAppSelector((s) => s.auth.authLoading);
  const { order, loading, error, notFound } = useOrder(orderId, uid);

  const [reason, setReason] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (notFound) {
      toastError(null, 'That order could not be found.');
      router.replace('/account/orders');
    }
  }, [notFound, router]);

  const isLoading = authLoading || loading || (!order && !notFound && !error);
  const item = order?.items.find((i) => i.productId === productId && i.variantId === variantId) ?? null;

  const hasDescription = description.trim().length >= MIN_DESCRIPTION_LENGTH;
  const hasPhotos = photos.length >= MIN_PHOTOS;
  const canSubmit = reason !== null && hasDescription && hasPhotos;

  async function handleSubmit() {
    if (!order || !item || !uid || !canSubmit) return;
    setSubmitting(true);
    try {
      const created = await submitReplacement({
        orderId: order.id,
        userId: uid,
        userName: user?.fullName || order.userName,
        userPhone: user?.phone || order.userPhone,
        userEmail: user?.email || order.userEmail,
        productId: item.productId,
        productName: item.productName,
        productImage: item.productImage,
        variantId: item.variantId,
        variantName: item.variantName,
        variantColor: item.variantColor,
        quantity: item.quantity,
        reason: reason!,
        description,
        photos,
      });
      setShowConfirm(false);
      toastSuccess(created.requestId ? `Return request ${created.requestId} submitted` : 'Return request submitted');
      router.push(`/account/orders/${order.id}`);
    } catch (e) {
      toastError(e, 'Could not submit your return request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (error) {
    return <EmptyState icon={<PackageX size={40} />} title="Could not load this order" subtitle={error} />;
  }

  if (isLoading || !order) {
    return (
      <div className="space-y-4" aria-busy="true">
        <SkeletonText width="w-1/3" />
        <div className="h-20 animate-pulse rounded-xl bg-subtle" />
        <div className="h-40 animate-pulse rounded-xl bg-subtle" />
      </div>
    );
  }

  if (!item) {
    return <EmptyState icon={<PackageX size={40} />} title="That item is not part of this order" />;
  }

  return (
    <div>
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'My Orders', href: '/account/orders' },
          { label: orderReference(order.id), href: `/account/orders/${order.id}` },
          { label: 'Return / Replace' },
        ]}
      />

      <div className="space-y-4">
        <div className="flex gap-3 rounded-xl border border-border bg-surface p-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.productImage} alt="" className="size-16 shrink-0 rounded-md border border-border object-cover" />
          <div className="min-w-0">
            <p className="line-clamp-2 text-sm font-semibold text-foreground">{item.productName}</p>
            <p className="mt-1 text-xs text-muted">
              {[item.variantName, item.variantColor].filter(Boolean).join(' · ')}
              {item.variantName || item.variantColor ? ' · ' : ''}Qty {item.quantity} · {money(item.subtotal)}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5">
          <h2 className="font-display text-base font-semibold text-foreground">Reason for return</h2>
          <div className="mt-2 divide-y divide-border">
            {REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className="flex w-full items-center gap-3 py-2.5 text-left"
              >
                <span
                  className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${
                    reason === r ? 'border-primary' : 'border-border-strong'
                  }`}
                >
                  {reason === r && <span className="size-2.5 rounded-full bg-primary" />}
                </span>
                <span className={`text-sm ${reason === r ? 'font-semibold text-foreground' : 'font-semibold text-foreground'}`}>
                  {r}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5">
          <h2 className="font-display text-base font-semibold text-foreground">Describe the issue *</h2>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 500))}
            rows={4}
            maxLength={500}
            placeholder="Tell us what went wrong…"
            className="mt-2 w-full rounded-lg border border-border-strong bg-app p-3 text-sm text-foreground outline-none focus:border-primary"
          />
          {!hasDescription && (
            <p className="mt-1 text-xs text-faint">
              {Math.max(0, MIN_DESCRIPTION_LENGTH - description.trim().length)} more character(s) needed
            </p>
          )}
        </div>

        <div className="rounded-xl border border-border bg-surface p-5">
          <h2 className="font-display text-base font-semibold text-foreground">Upload photos *</h2>
          <div className="mt-3">
            <PhotoUpload photos={photos} onChange={setPhotos} maxPhotos={MAX_PHOTOS} />
          </div>
          <p className={`mt-2 text-xs ${hasPhotos ? 'text-muted' : 'text-error'}`}>
            {hasPhotos ? `${photos.length} of ${MAX_PHOTOS} photos added` : 'At least 1 photo of the product is required.'}
          </p>
        </div>

        <div className="rounded-xl bg-primary-subtle p-4 text-sm font-semibold text-primary">
          Approved requests get a free replacement shipped within 24 hours
        </div>

        <Button variant="primary" fullWidth disabled={!canSubmit} onClick={() => setShowConfirm(true)}>
          Submit request
        </Button>
      </div>

      <ConfirmDialog
        isOpen={showConfirm}
        title="Submit this request?"
        description={`We will review your photos for ${item.productName} and get back to you.`}
        confirmLabel="Submit"
        loading={submitting}
        onConfirm={handleSubmit}
        onClose={() => {
          if (!submitting) setShowConfirm(false);
        }}
      />
    </div>
  );
}
