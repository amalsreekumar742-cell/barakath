'use client';

import { useEffect, useMemo, useRef } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { toastError } from '@/lib/toast';
import { ACCEPTED_PHOTO_TYPES, MAX_PHOTO_BYTES } from '../api/replacements';

export interface PhotoUploadProps {
  photos: File[];
  onChange: (photos: File[]) => void;
  maxPhotos: number;
}

/**
 * Evidence-photo picker for Request Replacement (spec 2.18): 1–5 photos, each under 2MB, JPG/PNG/WebP —
 * validated here (client-friendly rejection message) with `firebase/storage.rules`'s `validImage()` as
 * the server backstop. No crop step — see `features/orders/api/replacements.ts`'s `compress` for why a
 * damaged-product photo is never cropped to a fixed ratio. Compression itself happens at submit time
 * (this component only picks and previews raw files), so the preview shows exactly what was selected.
 */
export function PhotoUpload({ photos, onChange, maxPhotos }: PhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Object URLs for the preview grid — revoked on every change so a long editing session doesn't leak
  // memory across dozens of picks.
  const previews = useMemo(() => photos.map((f) => URL.createObjectURL(f)), [photos]);
  useEffect(() => {
    return () => previews.forEach((url) => URL.revokeObjectURL(url));
  }, [previews]);

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const incoming = Array.from(files);
    const accepted: File[] = [];
    let rejected = 0;

    for (const file of incoming) {
      if (!ACCEPTED_PHOTO_TYPES.includes(file.type) || file.size > MAX_PHOTO_BYTES) {
        rejected++;
        continue;
      }
      accepted.push(file);
    }

    const merged = [...photos, ...accepted].slice(0, maxPhotos);
    onChange(merged);

    if (rejected > 0) {
      toastError(null, `${rejected} photo${rejected === 1 ? '' : 's'} skipped — use JPG, PNG or WebP under 2MB.`);
    }
    if (inputRef.current) inputRef.current.value = '';
  }

  function remove(index: number) {
    onChange(photos.filter((_, i) => i !== index));
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        {previews.map((src, i) => (
          <div key={i} className="relative aspect-square overflow-hidden rounded-lg border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="size-full object-cover" />
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label="Remove photo"
              className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-ink/70 text-white hover:bg-ink"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </div>
        ))}
        {photos.length < maxPhotos && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border-strong text-muted hover:border-primary hover:text-primary"
          >
            <ImagePlus className="size-5" aria-hidden />
            <span className="text-[11px] font-medium">Add photo</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_PHOTO_TYPES.join(',')}
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
