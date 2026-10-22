'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * Lets the variant selector steer the product galleries: picking a colour asks both galleries
 * (`MobileGallery` below 1024px, `Gallery` above) to slide to that colour's photo.
 *
 * WHY a context rather than lifted state: the galleries and `ProductExperience` are siblings inside a
 * SERVER page, so there is no client parent to hold a shared index — this provider is that parent,
 * and the server-rendered children pass straight through it.
 *
 * `seq` bumps on every request, so re-picking the colour already shown still jumps back to its photo
 * after the shopper has swiped elsewhere (the url alone would not change).
 */
interface GalleryFocusValue {
  url: string | null;
  seq: number;
  focus: (url: string) => void;
}

const GalleryFocusContext = createContext<GalleryFocusValue>({ url: null, seq: 0, focus: () => {} });

export function GalleryFocusProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<{ url: string | null; seq: number }>({ url: null, seq: 0 });
  const focus = useCallback((url: string) => setTarget((t) => ({ url, seq: t.seq + 1 })), []);
  const value = useMemo(() => ({ ...target, focus }), [target, focus]);
  return <GalleryFocusContext.Provider value={value}>{children}</GalleryFocusContext.Provider>;
}

export function useGalleryFocus(): GalleryFocusValue {
  return useContext(GalleryFocusContext);
}
