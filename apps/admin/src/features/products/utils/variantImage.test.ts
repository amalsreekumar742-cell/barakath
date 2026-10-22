import { describe, it, expect } from 'vitest';
import { variantImageIndex } from '@barakath/shared/utils/variantImage';

// The shared colour → photo rule (packages/shared has no test runner, so it is exercised here). The
// Flutter app mirrors it in ProductDetailProvider._linkedImageIndex — keep the cases in step.

const images = ['black.jpg', 'white.jpg', 'box.jpg'];
const v = (color: string, imageUrl?: string) => ({ color, imageUrl });

describe('variantImageIndex', () => {
  it("uses the variant's own link", () => {
    expect(variantImageIndex([v('Black', 'black.jpg'), v('White', 'white.jpg')], v('White', 'white.jpg'), images)).toBe(1);
  });

  it('falls back to another size of the same colour', () => {
    const variants = [v('White'), v('White', 'white.jpg'), v('Black', 'black.jpg')];
    expect(variantImageIndex(variants, variants[0]!, images)).toBe(1);
  });

  it('never borrows a different colour', () => {
    const variants = [v('White'), v('Black', 'black.jpg')];
    expect(variantImageIndex(variants, variants[0]!, images)).toBeNull();
  });

  it('ignores a link to a photo no longer in the gallery', () => {
    const variants = [v('White', 'deleted.jpg'), v('White', 'box.jpg')];
    expect(variantImageIndex(variants, variants[0]!, images)).toBe(2);
    expect(variantImageIndex([v('White', 'deleted.jpg')], v('White', 'deleted.jpg'), images)).toBeNull();
  });

  it('is null when nothing is linked', () => {
    expect(variantImageIndex([v('White'), v('Black')], v('White'), images)).toBeNull();
  });
});
