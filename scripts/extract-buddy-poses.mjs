/* global console, process */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const configPath = process.env.BUDDY_POSE_CONFIG
  ? path.resolve(repoRoot, process.env.BUDDY_POSE_CONFIG)
  : path.join(__dirname, 'buddy-pose-config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const sourcePath = path.join(repoRoot, config.source);
const outputDir = path.join(repoRoot, config.outputDir);
const source = PNG.sync.read(fs.readFileSync(sourcePath));

assertSource(source, config.expectedSource);
assertPoseIds(config.poses);

const extracted = config.poses.map((pose) => extractPose(source, pose, config.backgroundThreshold));
const standing = extracted.filter((pose) => pose.kind === 'standing');
const scale = computeSharedScale(
  standing.map((pose) => pose.trimmed),
  config.canvas.width,
  config.canvas.height,
  config.canvas.padding,
);

fs.mkdirSync(outputDir, { recursive: true });
for (const pose of extracted) {
  const logical = composePose(pose, config.canvas, pose.kind === 'standing' ? scale : scale);
  const outputPath = path.join(outputDir, `${pose.id}.png`);
  fs.writeFileSync(outputPath, PNG.sync.write(logical));
  console.log(`${pose.id}: ${outputPath}`);
}

function assertSource(png, expected) {
  const actual = {
    width: png.width,
    height: png.height,
    bitDepth: png.depth,
    colorType: png.colorType,
  };
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (actual[key] !== expectedValue) {
      throw new Error(
        `Unexpected source ${key}: expected ${expectedValue}, received ${actual[key]}. Update ${configPath} intentionally if the source art changes.`,
      );
    }
  }
}

function assertPoseIds(poses) {
  const required = [
    'neutral-front',
    'neutral-side',
    'neutral-back',
    'curious',
    'happy',
    'proud',
    'concerned',
    'thinking',
    'writing',
    'sleeping',
  ];
  const actual = poses.map((pose) => pose.id);
  for (const id of required) {
    if (!actual.includes(id)) {
      throw new Error(`Missing extraction configuration for pose: ${id}`);
    }
  }
  if (new Set(actual).size !== actual.length) {
    throw new Error('Duplicate pose IDs are not allowed in extraction configuration.');
  }
}

function extractPose(sourcePng, pose, threshold) {
  const crop = cropPng(sourcePng, pose.rect);
  const background = averageCornerColor(crop);
  const transparent = floodRemoveBackground(crop, background, threshold);
  const trimmed = trimTransparent(transparent);
  return {
    id: pose.id,
    kind: pose.kind,
    trimmed,
  };
}

function cropPng(sourcePng, rect) {
  assertRect(sourcePng, rect);
  const crop = new PNG({ width: rect.width, height: rect.height, colorType: 6 });
  for (let y = 0; y < rect.height; y += 1) {
    for (let x = 0; x < rect.width; x += 1) {
      copyPixel(sourcePng, crop, rect.x + x, rect.y + y, x, y);
    }
  }
  return crop;
}

function assertRect(sourcePng, rect) {
  if (
    rect.x < 0 ||
    rect.y < 0 ||
    rect.width <= 0 ||
    rect.height <= 0 ||
    rect.x + rect.width > sourcePng.width ||
    rect.y + rect.height > sourcePng.height
  ) {
    throw new Error(`Invalid crop rectangle: ${JSON.stringify(rect)}`);
  }
}

function averageCornerColor(png) {
  const samples = [];
  const sampleSize = 12;
  const corners = [
    { x: 0, y: 0 },
    { x: png.width - sampleSize, y: 0 },
    { x: 0, y: png.height - sampleSize },
    { x: png.width - sampleSize, y: png.height - sampleSize },
  ];
  for (const corner of corners) {
    for (let y = corner.y; y < corner.y + sampleSize; y += 1) {
      for (let x = corner.x; x < corner.x + sampleSize; x += 1) {
        const index = pixelIndex(png, x, y);
        samples.push([png.data[index], png.data[index + 1], png.data[index + 2]]);
      }
    }
  }
  return samples
    .reduce(
      (sum, sample) => [sum[0] + sample[0], sum[1] + sample[1], sum[2] + sample[2]],
      [0, 0, 0],
    )
    .map((value) => Math.round(value / samples.length));
}

function floodRemoveBackground(png, background, threshold) {
  const output = clonePng(png);
  const visited = new Uint8Array(png.width * png.height);
  const queue = [];
  for (let x = 0; x < png.width; x += 1) {
    queue.push([x, 0], [x, png.height - 1]);
  }
  for (let y = 0; y < png.height; y += 1) {
    queue.push([0, y], [png.width - 1, y]);
  }

  while (queue.length > 0) {
    const [x, y] = queue.pop();
    if (x < 0 || y < 0 || x >= png.width || y >= png.height) {
      continue;
    }
    const visitIndex = y * png.width + x;
    if (visited[visitIndex]) {
      continue;
    }
    visited[visitIndex] = 1;

    const index = pixelIndex(output, x, y);
    if (!isBackgroundLike(output, index, background, threshold)) {
      continue;
    }
    clearPixel(output, index);
    queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const index = pixelIndex(output, x, y);
      if (isBackgroundLike(output, index, background, threshold)) {
        clearPixel(output, index);
      }
    }
  }
  return output;
}

function isBackgroundLike(png, index, background, threshold) {
  if (png.data[index + 3] === 0) {
    return true;
  }
  const dr = png.data[index] - background[0];
  const dg = png.data[index + 1] - background[1];
  const db = png.data[index + 2] - background[2];
  return Math.sqrt(dr * dr + dg * dg + db * db) <= threshold;
}

function trimTransparent(png) {
  let minX = png.width;
  let minY = png.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const index = pixelIndex(png, x, y);
      if (png.data[index + 3] > 0) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  if (maxX < minX || maxY < minY) {
    throw new Error('Crop produced an empty pose after background removal.');
  }
  return cropPng(png, {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  });
}

function computeSharedScale(poses, canvasWidth, canvasHeight, padding) {
  const maxWidth = Math.max(...poses.map((pose) => pose.width));
  const maxHeight = Math.max(...poses.map((pose) => pose.height));
  return Math.min((canvasWidth - padding * 2) / maxWidth, (canvasHeight - padding * 2) / maxHeight);
}

function composePose(pose, canvas) {
  const scaled = resizeNearest(
    pose.trimmed,
    Math.max(1, Math.round(pose.trimmed.width * scaleFor(pose))),
    Math.max(1, Math.round(pose.trimmed.height * scaleFor(pose))),
  );
  const output = new PNG({ width: canvas.width, height: canvas.height, colorType: 6 });
  output.data.fill(0);
  const baseline = pose.kind === 'sleeping' ? canvas.sleepingBaseline : canvas.standingBaseline;
  const targetX = Math.round((canvas.width - scaled.width) / 2);
  const targetY = Math.round(baseline - scaled.height);
  blit(scaled, output, targetX, targetY);
  return output;
}

function scaleFor(pose) {
  return pose.kind === 'sleeping' ? Math.min(scale, 0.72) : scale;
}

function resizeNearest(sourcePng, width, height) {
  const output = new PNG({ width, height, colorType: 6 });
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(sourcePng.width - 1, Math.floor((x / width) * sourcePng.width));
      const sourceY = Math.min(sourcePng.height - 1, Math.floor((y / height) * sourcePng.height));
      copyPixel(sourcePng, output, sourceX, sourceY, x, y);
    }
  }
  return output;
}

function blit(sourcePng, targetPng, targetX, targetY) {
  for (let y = 0; y < sourcePng.height; y += 1) {
    for (let x = 0; x < sourcePng.width; x += 1) {
      const destinationX = targetX + x;
      const destinationY = targetY + y;
      if (
        destinationX < 0 ||
        destinationY < 0 ||
        destinationX >= targetPng.width ||
        destinationY >= targetPng.height
      ) {
        continue;
      }
      copyPixel(sourcePng, targetPng, x, y, destinationX, destinationY);
    }
  }
}

function clonePng(png) {
  const output = new PNG({ width: png.width, height: png.height, colorType: 6 });
  png.data.copy(output.data);
  return output;
}

function copyPixel(sourcePng, targetPng, sourceX, sourceY, targetX, targetY) {
  const sourceIndex = pixelIndex(sourcePng, sourceX, sourceY);
  const targetIndex = pixelIndex(targetPng, targetX, targetY);
  targetPng.data[targetIndex] = sourcePng.data[sourceIndex];
  targetPng.data[targetIndex + 1] = sourcePng.data[sourceIndex + 1];
  targetPng.data[targetIndex + 2] = sourcePng.data[sourceIndex + 2];
  targetPng.data[targetIndex + 3] = sourcePng.data[sourceIndex + 3];
}

function pixelIndex(png, x, y) {
  return (png.width * y + x) << 2;
}

function clearPixel(png, index) {
  png.data[index] = 0;
  png.data[index + 1] = 0;
  png.data[index + 2] = 0;
  png.data[index + 3] = 0;
}
