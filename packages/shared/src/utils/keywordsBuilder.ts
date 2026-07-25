// packages/shared/src/utils/keywordsBuilder.ts — generate the `keywords: string[]` search field.
// WHAT: expands a string into all lowercased, punctuation-stripped prefix substrings (and
//   word-shifted variants), deduplicated.
// WHY prefix substrings: Firestore has no case-insensitive "contains"; precomputing every prefix
//   lets `array-contains` match partial / starts-with queries with a single indexed lookup, instead
//   of scanning and filtering documents client-side (which is slow and bills a read per doc).
// Store the result in a doc's `keywords` field WHEN THE DOC IS WRITTEN (server-side), then query with
//   where('keywords', 'array-contains', term.trim().toLowerCase()).
function keywordsBuilder(value: string): string[] {
  const list: string[] = [];
  const parts = value.split(' ');
  for (let i = 0; i < parts.length; i++) {
    let name = '';
    for (let k = i; k < parts.length; k++) name += `${parts[k]} `;
    let temp = '';
    for (let j = 0; j < name.length; j++) {
      temp += name[j];
      list.push(temp.toLowerCase().replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s/g, ''));
    }
  }
  return Array.from(new Set(list.filter((e) => e !== '')));
}

export default keywordsBuilder;
