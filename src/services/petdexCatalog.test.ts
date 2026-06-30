import { describe, expect, it, vi } from 'vitest';
import { fetchFeaturedPetdexSkins } from './petdexCatalog';

describe('fetchFeaturedPetdexSkins', () => {
  it('requests the narrow native command and validates the response', async () => {
    const invoker = vi.fn().mockResolvedValue([
      {
        id: 'boba',
        displayName: 'Boba',
        source: 'petdex',
        spritesheetUrl: 'https://assets.petdex.dev/community/boba/spritesheet.webp',
      },
      {
        id: '../../bad',
        displayName: 'Bad',
        source: 'petdex',
        spritesheetUrl: 'https://evil.example/bad.webp',
      },
    ]);

    await expect(fetchFeaturedPetdexSkins(invoker)).resolves.toHaveLength(1);
    expect(invoker).toHaveBeenCalledWith('list_featured_petdex_skins');
  });
});
