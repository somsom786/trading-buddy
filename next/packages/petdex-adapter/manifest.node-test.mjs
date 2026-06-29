import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PETDEX_HEIGHT,
  PETDEX_WIDTH,
  validatePetManifest,
  validateSpritesheetDimensions,
} from './manifest.mjs';

const validManifest = {
  id: 'trading-buddy-default',
  displayName: 'Trading Buddy',
  description: 'The original Trading Buddy companion.',
  spritesheetPath: 'spritesheet.png',
};

test('accepts the static bundled manifest', () => {
  assert.deepEqual(validatePetManifest(validManifest), { errors: [], valid: true });
});

test('rejects traversal and executable pet metadata', () => {
  const result = validatePetManifest({
    ...validManifest,
    hooks: { onClick: 'run-me' },
    spritesheetPath: '../outside.png',
  });

  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /spritesheetPath/);
  assert.match(result.errors.join(' '), /executable/);
});

test('enforces the current Petdex 8 by 9 atlas', () => {
  assert.deepEqual(validateSpritesheetDimensions(PETDEX_WIDTH, PETDEX_HEIGHT), {
    errors: [],
    valid: true,
  });
  assert.equal(validateSpritesheetDimensions(128, 128).valid, false);
});
