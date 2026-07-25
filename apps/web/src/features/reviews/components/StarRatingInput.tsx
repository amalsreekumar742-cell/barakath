'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';

export interface StarRatingInputProps {
  value: number;
  onChange: (rating: number) => void;
}

/**
 * The 5-star tap input on the write-review form (design: "How would you rate it?"). Integer only —
 * matches the Flutter app's `StarRatingInput` (`allowHalfRating: false`) and the create rule's
 * `rating is number && rating >= 1 && rating <= 5`.
 */
export function StarRatingInput({ value, onChange }: StarRatingInputProps) {
  const [hovered, setHovered] = useState(0);
  const shown = hovered || value;

  return (
    <div>
      <div className="flex gap-1.5" onMouseLeave={() => setHovered(0)}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            aria-label={`${star} star${star === 1 ? '' : 's'}`}
            onMouseEnter={() => setHovered(star)}
            onClick={() => onChange(star)}
            className="p-0.5"
          >
            <Star
              size={34}
              strokeWidth={1.5}
              className={star <= shown ? 'fill-current text-gold' : 'text-border-strong'}
            />
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-faint">Tap a star to rate</p>
    </div>
  );
}
