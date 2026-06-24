import { describe, expect, it } from 'vitest';
import { looksLikeSecret, safeSecretRefusal } from './secretDetection';

describe('looksLikeSecret', () => {
  it('detects fake secret-shaped values without requiring real credentials', () => {
    expect(looksLikeSecret('password: fake-password-123')).toBe(true);
    expect(looksLikeSecret('api key sk-fakeFakeFake123456')).toBe(true);
    expect(
      looksLikeSecret(
        'seed phrase abandon ability able about above absent absorb abstract absurd abuse access accident',
      ),
    ).toBe(true);
  });

  it('allows ordinary trading preferences', () => {
    expect(looksLikeSecret('I prefer direct feedback after risky trades.')).toBe(false);
  });

  it('does not echo secrets in the refusal copy', () => {
    expect(safeSecretRefusal()).not.toContain('fake-password');
  });
});
