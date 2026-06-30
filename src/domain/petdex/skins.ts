export const PETDEX_MANIFEST_URL = 'https://petdex.dev/api/manifest';

export interface PetSkinSelection {
  id: string;
  displayName: string;
  source: 'local' | 'petdex';
  spritesheetUrl?: string;
  submittedBy?: string;
}

export const DEFAULT_PET_SKIN: PetSkinSelection = {
  id: 'trading-buddy-default',
  displayName: 'Trading Buddy',
  source: 'local',
};

export const FEATURED_PETDEX_SKIN_IDS = ['boba', 'tiko', 'wangcai', 'mallow'] as const;

const PET_SKIN_STORAGE_KEY = 'trading-buddy.pet-skin.v1';
const SAFE_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

export function isPetSkinSelection(value: unknown): value is PetSkinSelection {
  if (!isRecord(value)) {
    return false;
  }
  if (typeof value.id !== 'string' || !SAFE_ID.test(value.id)) {
    return false;
  }
  if (typeof value.displayName !== 'string' || value.displayName.trim().length === 0) {
    return false;
  }
  if (value.source === 'local') {
    return value.id === DEFAULT_PET_SKIN.id && value.spritesheetUrl === undefined;
  }
  if (value.source !== 'petdex' || !isSafePetdexAssetUrl(value.spritesheetUrl)) {
    return false;
  }
  return value.submittedBy === undefined || typeof value.submittedBy === 'string';
}

export function parsePetdexManifest(value: unknown): PetSkinSelection[] {
  if (!isRecord(value) || !Array.isArray(value.pets)) {
    return [];
  }
  const featured = new Map<string, PetSkinSelection>();
  for (const candidate of value.pets) {
    if (!isRecord(candidate)) {
      continue;
    }
    const skin: PetSkinSelection = {
      id: typeof candidate.slug === 'string' ? candidate.slug : '',
      displayName: typeof candidate.displayName === 'string' ? candidate.displayName : '',
      source: 'petdex',
      ...(typeof candidate.spritesheetUrl === 'string'
        ? { spritesheetUrl: candidate.spritesheetUrl }
        : {}),
      ...(typeof candidate.submittedBy === 'string' ? { submittedBy: candidate.submittedBy } : {}),
    };
    if (
      FEATURED_PETDEX_SKIN_IDS.includes(skin.id as (typeof FEATURED_PETDEX_SKIN_IDS)[number]) &&
      isPetSkinSelection(skin)
    ) {
      featured.set(skin.id, skin);
    }
  }
  return FEATURED_PETDEX_SKIN_IDS.flatMap((id) => {
    const skin = featured.get(id);
    return skin ? [skin] : [];
  });
}

export function parsePetSkinSelections(value: unknown): PetSkinSelection[] {
  return Array.isArray(value) ? value.filter(isPetSkinSelection) : [];
}

export function loadSelectedPetSkin(
  storage: Pick<Storage, 'getItem'> = localStorage,
): PetSkinSelection {
  try {
    const raw = storage.getItem(PET_SKIN_STORAGE_KEY);
    const value: unknown = raw ? JSON.parse(raw) : null;
    return isPetSkinSelection(value) ? value : DEFAULT_PET_SKIN;
  } catch {
    return DEFAULT_PET_SKIN;
  }
}

export function saveSelectedPetSkin(
  skin: PetSkinSelection,
  storage: Pick<Storage, 'setItem'> = localStorage,
): void {
  if (isPetSkinSelection(skin)) {
    storage.setItem(PET_SKIN_STORAGE_KEY, JSON.stringify(skin));
  }
}

function isSafePetdexAssetUrl(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.hostname === 'assets.petdex.dev' &&
      /\.(?:png|webp)$/i.test(url.pathname)
    );
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
