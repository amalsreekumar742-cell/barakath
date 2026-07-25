'use client';

import { useEffect, useMemo, useRef } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { toastError } from '@/lib/toast';
import { ACCEPTED_PHOTO_TYPES, MAX_PHOTO_BYTES } from '../api/reviews';

export interface PhotoUploadProps {
  photos: File[];
  onChange: (photos: File[]) => void;
  maxPhotos: number;
}

/**
 * Optional review-photo picker (design: "Add photos (optional)"), 0–3 photos, each under 2MB, JPG/PNG/
 * WebP — validated here with `firebase/storage.rules`'s `validImage()` as the server backstop.
 *
 * WHY its own copy rather than importing `features/orders/components/PhotoUpload`: this codebase's own
 * ESLint rule (`import/no-restricted-paths`) keeps features from reaching into each other's internals —
 * see that rule's own message ("compose at the app/route layer, or move the shared piece into src/
 * components/src/lib/packages/shared"). This widget is small enough that duplicating it here is cheaper
 * and safer than adding a new cross-feature exception or relocating the orders one out from under it.
 */
export function PhotoUpload({ photos, onChange, maxPhotos }: PhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

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
