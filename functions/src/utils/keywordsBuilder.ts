/**
 * keywordsBuilder — builds the prefix-substring keyword array used for Firestore array-contains search.
 * Duplicated from packages/shared/src/utils (functions can't import the workspace package at runtime).
 * Keep identical to the shared version so admin-created and function-created docs search the same way.
 */
function keywordsBuilder(value: string): string[] {
  const list: string[] = [];
  const parts = value.split(' ');
  for (let i = 0; i < parts.length; i++) {
    let name = '';
    for (let k = i; k < parts.length; k++) name += `${parts[k]} `;
    let temp = '';
    for (let j = 0; j < name.length; j++) {
      temp += name[j];
      list.push(
        temp
          .toLowerCase()
          .replace(/[^a-zA-Z0-9\s]/g, '')
          .replace(/\s/g, ''),
      );
    }
  }
  return Array.from(new Set(list.filter((e) => e !== '')));
}

export default keywordsBuilder;
