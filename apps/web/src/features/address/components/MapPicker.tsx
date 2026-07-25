'use client';

import { useEffect, useRef, useState } from 'react';
import { LocateFixed } from 'lucide-react';
import { parseAddressComponents, type ResolvedLocation } from '../utils/googleMaps';

/**
 * MapPicker — an OPTIONAL Places-autocomplete search box + draggable-pin map that prefills
 * `AddressForm`'s fields via reverse geocoding. Degrades to nothing when
 * `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is absent or the script fails to load — it must never block
 * manual address entry, so it renders `null` rather than an error state in either case; the form
 * below it works exactly the same either way.
 *
 * WHY a hand-rolled script loader instead of a package: mirrors `lib/commerce/razorpay.ts`'s same
 * choice for the same reason — no `@googlemaps/js-api-loader` (or similar) is installed in this
 * workspace, and this batch has no network access to add one. The loader here is scoped to this one
 * component (module-level promise cache) rather than shared, since nothing else in the app needs Maps.
 */

const SCRIPT_ID = 'barakath-google-maps-script';
let mapsLoadingPromise: Promise<void> | null = null;

function loadGoogleMaps(apiKey: string): Promise<void> {
  if (typeof window !== 'undefined' && window.google?.maps) return Promise.resolve();
  if (mapsLoadingPromise) return mapsLoadingPromise;

  mapsLoadingPromise = new Promise<void>((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('Google Maps can only load in the browser.'));
      return;
    }
    if (document.getElementById(SCRIPT_ID)) {
      // Another MapPicker instance already requested it — poll briefly rather than double-inject.
      const check = window.setInterval(() => {
        if (window.google?.maps) {
          window.clearInterval(check);
          resolve();
        }
      }, 100);
      return;
    }
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      mapsLoadingPromise = null;
      reject(new Error('Could not load Google Maps.'));
    };
    document.body.appendChild(script);
  });

  return mapsLoadingPromise;
}

export interface MapPickerProps {
  /** Called with whatever the geocoder resolved — the caller (`AddressForm`) decides which fields to
   *  overwrite (never overwrites a field the customer already typed something into). */
  onResolved: (location: ResolvedLocation) => void;
}

export function MapPicker({ onResolved }: MapPickerProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const inputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const onResolvedRef = useRef(onResolved);
  onResolvedRef.current = onResolved;
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>(apiKey ? 'loading' : 'unavailable');

  useEffect(() => {
    if (!apiKey) return;
    let cancelled = false;

    loadGoogleMaps(apiKey)
      .then(() => {
        if (cancelled || !inputRef.current || !mapRef.current || !window.google) return;
        const maps = window.google.maps;
        const INDIA_CENTROID = { lat: 20.5937, lng: 78.9629 };

        const map = new maps.Map(mapRef.current, {
          center: INDIA_CENTROID,
          zoom: 5,
          disableDefaultUI: true,
          zoomControl: true,
        });
        const marker = new maps.Marker({ position: INDIA_CENTROID, map, draggable: true });
        const geocoder = new maps.Geocoder();

        function resolveFromLatLng(lat: number, lng: number) {
          geocoder.geocode({ location: { lat, lng } }, (results, geoStatus) => {
            if (geoStatus !== 'OK' || !results?.[0]) return;
            onResolvedRef.current(parseAddressComponents(results[0].address_components, lat, lng));
          });
        }

        marker.addListener('dragend', () => {
          const pos = marker.getPosition();
          if (pos) resolveFromLatLng(pos.lat(), pos.lng());
        });

        const autocomplete = new maps.places.Autocomplete(inputRef.current!, {
          componentRestrictions: { country: 'in' },
        });
        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          const loc = place.geometry?.location;
          if (!loc) return;
          map.setCenter(loc);
          map.setZoom(16);
          marker.setPosition(loc);
          onResolvedRef.current(
            place.address_components
              ? parseAddressComponents(place.address_components, loc.lat(), loc.lng())
              : { lat: loc.lat(), lng: loc.lng() },
          );
        });

        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('unavailable');
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  if (!apiKey || status === 'unavailable') return null;

  return (
    <div className="space-y-2">
      <label className="mb-1.5 block text-xs font-extrabold uppercase tracking-wide text-muted">
        Search for your location (optional)
      </label>
      <input
        ref={inputRef}
        type="text"
        placeholder="Search a place or drag the pin below"
        className="h-11 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground outline-none focus:border-primary"
      />
      <div ref={mapRef} className="h-48 w-full overflow-hidden rounded-md border border-border-strong bg-subtle" />
      {status === 'loading' && (
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <LocateFixed size={13} /> Loading map…
        </p>
      )}
    </div>
  );
}
