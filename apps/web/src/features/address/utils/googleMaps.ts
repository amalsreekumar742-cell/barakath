/**
 * Minimal, hand-written structural types for the small slice of the Google Maps JavaScript API
 * `MapPicker.tsx` actually calls (`Map`, `Marker`, `Geocoder`, `places.Autocomplete`).
 *
 * WHY not the `@types/google.maps` package: it is not installed in this workspace (verified — absent
 * from `apps/web/package.json` and `node_modules`), and this batch has no network access to add and
 * lock a new dependency. A full-namespace ambient package would also type far more of the API than
 * `MapPicker` uses. These narrower interfaces cover exactly the calls made here; if a later session
 * needs more of the API, installing `@types/google.maps` and deleting this file is a clean upgrade
 * path (the shapes below are intentionally a subset of the real ones, same field names).
 */

export interface GoogleLatLng {
  lat(): number;
  lng(): number;
}

export interface GoogleMapInstance {
  setCenter(position: { lat: number; lng: number } | GoogleLatLng): void;
  setZoom(zoom: number): void;
}

export interface GoogleMarker {
  setPosition(position: { lat: number; lng: number } | GoogleLatLng): void;
  getPosition(): GoogleLatLng | undefined;
  addListener(event: 'dragend', handler: () => void): void;
}

export interface GoogleAddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

export interface GoogleGeocoderResult {
  address_components: GoogleAddressComponent[];
}

export interface GoogleGeocoder {
  geocode(
    request: { location: { lat: number; lng: number } },
    callback: (results: GoogleGeocoderResult[] | null, status: string) => void,
  ): void;
}

export interface GooglePlaceResult {
  geometry?: { location?: GoogleLatLng };
  address_components?: GoogleAddressComponent[];
}

export interface GoogleAutocomplete {
  addListener(event: 'place_changed', handler: () => void): void;
  getPlace(): GooglePlaceResult;
}

export interface GoogleMapsNamespace {
  Map: new (el: HTMLElement, options: Record<string, unknown>) => GoogleMapInstance;
  Marker: new (options: Record<string, unknown>) => GoogleMarker;
  Geocoder: new () => GoogleGeocoder;
  places: {
    Autocomplete: new (el: HTMLInputElement, options?: Record<string, unknown>) => GoogleAutocomplete;
  };
}

declare global {
  interface Window {
    google?: { maps: GoogleMapsNamespace };
  }
}

/** Turn a geocode/place result's `address_components` into the fields `AddressForm` prefills. Only
 *  the fields a geocoder is genuinely reliable about — the customer still writes their own house and
 *  street, which no geocoder gets right (same principle the Flutter app's `_useMyLocation` documents). */
export function parseAddressComponents(
  components: GoogleAddressComponent[],
  lat: number,
  lng: number,
): ResolvedLocation {
  const find = (type: string) => components.find((c) => c.types.includes(type))?.long_name;
  return {
    addressLine1: [find('street_number'), find('route')].filter(Boolean).join(' ') || undefined,
    area: find('sublocality_level_1') ?? find('sublocality'),
    city: find('locality') ?? find('administrative_area_level_2'),
    state: find('administrative_area_level_1'),
    pincode: find('postal_code'),
    lat,
    lng,
  };
}

export interface ResolvedLocation {
  addressLine1?: string;
  area?: string;
  city?: string;
  state?: string;
  pincode?: string;
  lat: number;
  lng: number;
}
