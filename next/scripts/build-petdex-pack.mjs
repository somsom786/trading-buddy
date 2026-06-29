/* global console */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

import {
  assertValidPetPack,
  PETDEX_COLUMNS,
  PETDEX_FRAME_HEIGHT,
  PETDEX_FRAME_WIDTH,
  PETDEX_HEIGHT,
  PETDEX_STATES,
  PETDEX_WIDTH,
} from '../packages/petdex-adapter/manifest.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../..');
const posesDir = path.join(repoRoot, 'src/assets/buddy/poses');
const outputDir = path.join(repoRoot, 'next/pets/trading-buddy-default');
const manifestPath = path.join(outputDir, 'pet.json');
const spritePath = path.join(outputDir, 'spritesheet.png');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const sheet = new PNG({ colorType: 6, height: PETDEX_HEIGHT, width: PETDEX_WIDTH });
sheet.data.fill(0);

const rowSpecs = [
  { pose: 'neutral-front' },
  { pose: 'neutral-side', offsets: [0, 1, 0, -1, 0, 1] },
  { mirror: true, pose: 'neutral-side', offsets: [0, -1, 0, 1, 0, -1] },
  { pose: 'curious', alternates: ['curious', 'happy'] },
  { pose: 'proud', vertical: [0, -5, -10, -5, 0, 2] },
  { pose: 'concerned' },
  { pose: 'thinking', alternates: ['thinking', 'neutral-front'] },
  { pose: 'neutral-side', mirrorAlternate: true, offsets: [-2, 0, 2, 0, -2, 0] },
  { pose: 'writing', alternates: ['writing', 'thinking'] },
];

for (let row = 0; row < rowSpecs.length; row += 1) {
  const spec = rowSpecs[row];
  for (let column = 0; column < PETDEX_COLUMNS; column += 1) {
    const alternate = spec.alternates?.[column % spec.alternates.length];
    const pose = readPose(alternate ?? spec.pose);
    const frame = resizeNearest(
      pose,
      192,
      192,
      spec.mirror || (spec.mirrorAlternate && column % 2 === 1),
    );
    const x = column * PETDEX_FRAME_WIDTH + (spec.offsets?.[column % spec.offsets.length] ?? 0);
    const y = row * PETDEX_FRAME_HEIGHT + 8 + (spec.vertical?.[column % spec.vertical.length] ?? 0);
    blit(frame, sheet, x, y);
  }
}

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(spritePath, PNG.sync.write(sheet));
assertValidPetPack(manifest, sheet);
console.log(
  `Built ${path.relative(repoRoot, spritePath)} (${PETDEX_WIDTH}x${PETDEX_HEIGHT}, ${PETDEX_STATES.length} states).`,
);

function readPose(name) {
  const pose = PNG.sync.read(fs.readFileSync(path.join(posesDir, `${name}.png`)));
  if (pose.width !== 128 || pose.height !== 128) {
    throw new Error(`Expected ${name}.png to be 128x128; received ${pose.width}x${pose.height}.`);
  }
  return pose;
}

function resizeNearest(source, width, height, mirror = false) {
  const output = new PNG({ colorType: 6, height, width });
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const logicalX = mirror ? width - x - 1 : x;
      const sourceX = Math.min(source.width - 1, Math.floor((logicalX / width) * source.width));
      const sourceY = Math.min(source.height - 1, Math.floor((y / height) * source.height));
      copyPixel(source, output, sourceX, sourceY, x, y);
    }
  }
  return output;
}

function blit(source, target, targetX, targetY) {
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const xOut = targetX + x;
      const yOut = targetY + y;
      if (xOut >= 0 && yOut >= 0 && xOut < target.width && yOut < target.height) {
        copyPixel(source, target, x, y, xOut, yOut);
      }
    }
  }
}

function copyPixel(source, target, sourceX, sourceY, targetX, targetY) {
  const sourceIndex = (source.width * sourceY + sourceX) << 2;
  const targetIndex = (target.width * targetY + targetX) << 2;
  source.data.copy(target.data, targetIndex, sourceIndex, sourceIndex + 4);
}
