import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { BUDDY_POSE_IDS, type BuddyPoseId } from '../../domain/companion/poseSelection';

interface ExtractionConfig {
  source: string;
  outputDir: string;
  expectedSource: {
    width: number;
    height: number;
    bitDepth: number;
    colorType: number;
  };
  canvas: {
    width: number;
    height: number;
    standingBaseline: number;
    sleepingBaseline: number;
    padding: number;
  };
  poses: {
    id: BuddyPoseId;
    rect: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    kind: 'standing' | 'sleeping';
  }[];
}

const config = JSON.parse(
  readFileSync('scripts/buddy-pose-config.json', 'utf8'),
) as ExtractionConfig;

describe('buddy pose extraction assets', () => {
  it('keeps extraction configuration complete and source dimensions explicit', () => {
    expect(config.source).toBe('src/assets/buddy/source/buddy-reference-sheet.png');
    expect(config.expectedSource).toEqual({
      width: 1408,
      height: 768,
      bitDepth: 8,
      colorType: 6,
    });
    expect(config.poses.map((pose) => pose.id).sort()).toEqual([...BUDDY_POSE_IDS].sort());
  });

  it('rejects unexpected source dimensions', () => {
    const tempDir = join(tmpdir(), `trading-buddy-pose-test-${String(Date.now())}`);
    mkdirSync(tempDir, { recursive: true });
    const badConfigPath = join(tempDir, 'bad-config.json');
    writeFileSync(
      badConfigPath,
      JSON.stringify({
        ...config,
        expectedSource: {
          ...config.expectedSource,
          width: config.expectedSource.width + 1,
        },
      }),
    );

    const result = spawnSync('node', ['scripts/extract-buddy-poses.mjs'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        BUDDY_POSE_CONFIG: badConfigPath,
      },
      encoding: 'utf8',
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Unexpected source width');
  });

  it('generates transparent 128x128 pose canvases', () => {
    for (const id of BUDDY_POSE_IDS) {
      const png = readPose(id);
      expect(png.width).toBe(config.canvas.width);
      expect(png.height).toBe(config.canvas.height);
      expect(cornerAlphas(png)).toEqual([0, 0, 0, 0]);
      expect(cornerRgb(png)).toEqual([
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
      ]);
      expect(hasOpaquePixels(png)).toBe(true);
    }
  });

  it('keeps standing pose baselines consistent', () => {
    const standingPoseIds = config.poses
      .filter((pose) => pose.kind === 'standing')
      .map((pose) => pose.id);

    for (const id of standingPoseIds) {
      expect(alphaBounds(readPose(id)).maxY).toBeGreaterThanOrEqual(
        config.canvas.standingBaseline - 1,
      );
      expect(alphaBounds(readPose(id)).maxY).toBeLessThanOrEqual(config.canvas.standingBaseline);
    }
  });

  it('keeps the sleeping pose lower and wider without using a standing baseline', () => {
    const bounds = alphaBounds(readPose('sleeping'));
    expect(bounds.maxY).toBeLessThanOrEqual(config.canvas.sleepingBaseline);
    expect(bounds.maxY).toBeGreaterThanOrEqual(config.canvas.sleepingBaseline - 1);
    expect(bounds.maxX - bounds.minX).toBeGreaterThan(bounds.maxY - bounds.minY);
  });
});

function readPose(id: BuddyPoseId): PNG {
  return PNG.sync.read(readFileSync(`src/assets/buddy/poses/${id}.png`));
}

function cornerAlphas(png: PNG): number[] {
  return cornerIndexes(png).map((index) => byteAt(png, index + 3));
}

function cornerRgb(png: PNG): number[][] {
  return cornerIndexes(png).map((index) => [
    byteAt(png, index),
    byteAt(png, index + 1),
    byteAt(png, index + 2),
  ]);
}

function cornerIndexes(png: PNG): number[] {
  return [
    pixelIndex(png, 0, 0),
    pixelIndex(png, png.width - 1, 0),
    pixelIndex(png, 0, png.height - 1),
    pixelIndex(png, png.width - 1, png.height - 1),
  ];
}

function hasOpaquePixels(png: PNG): boolean {
  for (let index = 3; index < png.data.length; index += 4) {
    if (byteAt(png, index) > 0) {
      return true;
    }
  }
  return false;
}

function alphaBounds(png: PNG): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = png.width;
  let minY = png.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      if (byteAt(png, pixelIndex(png, x, y) + 3) > 0) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  return { minX, minY, maxX, maxY };
}

function pixelIndex(png: PNG, x: number, y: number): number {
  return (png.width * y + x) << 2;
}

function byteAt(png: PNG, index: number): number {
  return png.data[index] ?? -1;
}
