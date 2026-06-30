import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PET_SKIN,
  isPetSkinSelection,
  loadSelectedPetSkin,
  parsePetdexManifest,
  saveSelectedPetSkin,
} from './skins';

describe('Petdex skin boundary', () => {
  it('keeps only curated skins with trusted Petdex asset URLs', () => {
    expect(
      parsePetdexManifest({
        pets: [
          {
            slug: 'boba',
            displayName: 'Boba',
            submittedBy: 'railly',
            spritesheetUrl: 'https://assets.petdex.dev/community/boba/spritesheet.webp',
          },
          {
            slug: 'tiko',
            displayName: 'Tiko',
            spritesheetUrl: 'https://evil.example/tiko.webp',
          },
          {
            slug: 'not-curated',
            displayName: 'Other',
            spritesheetUrl: 'https://assets.petdex.dev/community/other/spritesheet.webp',
          },
        ],
      }),
    ).toEqual([
      {
        id: 'boba',
        displayName: 'Boba',
        source: 'petdex',
        spritesheetUrl: 'https://assets.petdex.dev/community/boba/spritesheet.webp',
        submittedBy: 'railly',
      },
    ]);
  });

  it('rejects executable and non-Petdex URLs', () => {
    expect(
      isPetSkinSelection({
        id: 'boba',
        displayName: 'Boba',
        source: 'petdex',
        spritesheetUrl: 'javascript:alert(1)',
      }),
    ).toBe(false);
  });

  it('persists a validated selection and safely falls back', () => {
    let stored = '';
    const storage = {
      getItem: () => stored,
      setItem: (_key: string, value: string) => {
        stored = value;
      },
    };
    const skin = {
      id: 'boba',
      displayName: 'Boba',
      source: 'petdex' as const,
      spritesheetUrl: 'https://assets.petdex.dev/community/boba/spritesheet.webp',
    };
    saveSelectedPetSkin(skin, storage);
    expect(loadSelectedPetSkin(storage)).toEqual(skin);
    stored = '{"id":"../../bad"}';
    expect(loadSelectedPetSkin(storage)).toEqual(DEFAULT_PET_SKIN);
  });
});
