import path from 'node:path';

export const PETDEX_FRAME_WIDTH = 192;
export const PETDEX_FRAME_HEIGHT = 208;
export const PETDEX_COLUMNS = 8;
export const PETDEX_ROWS = 9;
export const PETDEX_WIDTH = PETDEX_FRAME_WIDTH * PETDEX_COLUMNS;
export const PETDEX_HEIGHT = PETDEX_FRAME_HEIGHT * PETDEX_ROWS;
export const PETDEX_STATES = [
  'idle',
  'running-right',
  'running-left',
  'waving',
  'jumping',
  'failed',
  'waiting',
  'running',
  'review',
];

const SAFE_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const ALLOWED_SPRITE_FILES = new Set(['spritesheet.png', 'spritesheet.webp']);

export function validatePetManifest(manifest) {
  const errors = [];

  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return { errors: ['manifest must be an object'], valid: false };
  }

  if (typeof manifest.id !== 'string' || !SAFE_ID.test(manifest.id)) {
    errors.push('id must be a lowercase, single-segment slug');
  }
  if (typeof manifest.displayName !== 'string' || manifest.displayName.trim().length === 0) {
    errors.push('displayName is required');
  }
  if (typeof manifest.description !== 'string') {
    errors.push('description must be a string');
  }
  if (!ALLOWED_SPRITE_FILES.has(manifest.spritesheetPath)) {
    errors.push('spritesheetPath must be spritesheet.png or spritesheet.webp');
  }
  if (
    typeof manifest.spritesheetPath === 'string' &&
    (path.isAbsolute(manifest.spritesheetPath) ||
      manifest.spritesheetPath.includes('/') ||
      manifest.spritesheetPath.includes('\\') ||
      manifest.spritesheetPath.includes('..'))
  ) {
    errors.push('spritesheetPath must not escape the pet directory');
  }
  if ('scripts' in manifest || 'executable' in manifest || 'hooks' in manifest) {
    errors.push('pet packs cannot declare executable behavior');
  }

  return { errors, valid: errors.length === 0 };
}

export function validateSpritesheetDimensions(width, height) {
  const valid = width === PETDEX_WIDTH && height === PETDEX_HEIGHT;
  return {
    errors: valid
      ? []
      : [`spritesheet must be ${PETDEX_WIDTH}x${PETDEX_HEIGHT}; received ${width}x${height}`],
    valid,
  };
}

export function assertValidPetPack(manifest, dimensions) {
  const manifestResult = validatePetManifest(manifest);
  const dimensionResult = validateSpritesheetDimensions(dimensions.width, dimensions.height);
  const errors = [...manifestResult.errors, ...dimensionResult.errors];

  if (errors.length > 0) {
    throw new Error(errors.join('; '));
  }
}
