'use client';

import { MapPin, Trash2 } from 'lucide-react';
import type { UserAddressProps } from '@barakath/shared';

export interface AddressCardProps {
  address: UserAddressProps;
  /** Renders as a radio row (checkout/picker use); omit for a plain card (the addresses list page). */
  selectable?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  onDelete?: () => void;
  deleting?: boolean;
}

/** One saved address: label, formatted address, phone, a DEFAULT badge, and a delete action — spec
 *  §2.14/§3.17. No edit action anywhere on this card: delete + add is the whole address lifecycle. */
export function AddressCard({
  address,
  selectable = false,
  selected = false,
  onSelect,
  onDelete,
  deleting = false,
}: AddressCardProps) {
  const formatted = [
    address.addressLine1,
    address.addressLine2,
    address.landmark,
    address.city,
    address.state,
    address.pincode,
  ]
    .filter((part) => part && part.trim().length > 0)
    .join(', ');

  return (
    <div
      role={selectable ? 'radio' : undefined}
      aria-checked={selectable ? selected : undefined}
      tabIndex={selectable ? 0 : undefined}
      onClick={selectable ? onSelect : undefined}
      onKeyDown={
        selectable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect?.();
              }
            }
          : undefined
      }
      className={`flex items-start gap-3 rounded-lg border p-4 transition ${selectable ? 'cursor-pointer' : ''} ${
        selectable && selected
          ? 'border-primary bg-primary-subtle'
          : 'border-border-strong bg-surface hover:bg-subtle'
      }`}
    >
      {selectable && (
        <span
          className={`mt-1 flex size-4 shrink-0 items-center justify-center rounded-full border-2 ${
            selected ? 'border-primary' : 'border-border-strong'
          }`}
        >
          {selected && <span className="size-2 rounded-full bg-primary" />}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-foreground">
            <MapPin size={14} />
            {address.label}
          </span>
          {address.isDefault && (
            <span className="rounded-full bg-primary-subtle px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
              Default
            </span>
          )}
        </div>
        <p className="mt-1 text-sm font-medium text-foreground">{address.fullName}</p>
        <p className="mt-0.5 text-sm text-muted">{formatted}</p>
        <p className="mt-0.5 text-sm text-muted">{address.phone}</p>
      </div>

      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          disabled={deleting}
          aria-label={`Delete ${address.label} address`}
          className="shrink-0 rounded-md p-2 text-muted transition hover:bg-error-subtle hover:text-error disabled:opacity-50"
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
}
