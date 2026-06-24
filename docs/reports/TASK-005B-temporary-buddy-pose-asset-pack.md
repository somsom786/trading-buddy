# Task 5B Report - Temporary Buddy Pose Asset Pack

**Date:** June 24, 2026  
**Project label:** Trading Buddy BETA v0.1  
**Audience:** External task author / GPT-5.5 task planner

## Scope honored

This task integrated the provided buddy character reference art as a temporary pose pack. It did
not implement final sprite animation, final branding, memory, journal, crypto integrations, cloud
models, accounts, browser extensions, voice, telemetry, or autonomous trading.

## Source image inspection

The user-provided source file was initially at:

```text
C:\Users\raynh\Documents\trading buddy\art.png
```

It was moved into the required repository source location:

```text
src/assets/buddy/source/buddy-reference-sheet.png
```

Observed PNG properties:

- Width: 1408 px
- Height: 768 px
- Bit depth: 8
- Color type: 6 / RGBA

This differs from the task prompt's stated 1024×559 RGB description. The extraction pipeline
therefore validates the actual checked-in source dimensions and will fail if that source changes
unexpectedly.

## Extraction method

Added:

```text
scripts/buddy-pose-config.json
scripts/extract-buddy-poses.mjs
```

Regeneration command:

```powershell
pnpm buddy:extract
```

The script:

- reads the configured source PNG;
- validates source dimensions, bit depth, and PNG color type;
- crops explicitly configured pose rectangles;
- samples background colors from crop corners;
- removes background-like pixels with a conservative threshold;
- zeroes RGB values for transparent pixels;
- trims transparent space;
- applies nearest-neighbour resizing;
- places each pose on a shared transparent logical canvas;
- writes lossless PNG files.

`BUDDY_POSE_CONFIG` can point the script at an alternate config, which is used by tests to verify
dimension-rejection behavior.

## Crop configuration

Pose crops are stored in `scripts/buddy-pose-config.json`.

Generated pose mapping:

- top-left front pose -> `neutral-front`
- top-row side pose -> `neutral-side`
- top-row rear pose -> `neutral-back`
- top-row three-quarter pose -> `curious`
- top-row smiling pose -> `happy`
- bottom-left eyes-closed smile -> `proud`
- bottom concerned pose -> `concerned`
- bottom hand-to-face pose -> `thinking`
- bottom notebook pose -> `writing`
- right-side sleeping pose -> `sleeping`

The crop configuration excludes grid separators, palette swatches, silhouette preview, and unused
grey space.

## Background-removal approach

The script samples crop-corner background colors and removes background-like pixels using a
conservative RGB-distance threshold. It clears alpha and RGB for removed pixels so grey source
background does not appear even in alpha-unaware previews.

The threshold is intentionally not aggressive. It preserves cream face pixels, lavender details,
amber glow, and dark outlines over perfect shadow/background removal.

## Logical canvas size

Generated output canvas:

```text
128 × 128 px
```

All generated pose assets use this logical canvas. Runtime CSS uses pixelated/crisp rendering and
does not render the source sheet.

## Alignment strategy

- Standing poses share baseline `y=118`.
- Sleeping pose uses baseline `y=110`.
- Poses are horizontally centered.
- Standing poses use one shared scale factor.
- Sleeping uses the same extraction flow with a lower/wider visible bounding box.

Automated tests assert the shared canvas, transparent corners, and standing baseline tolerance.

## Generated assets

```text
src/assets/buddy/poses/neutral-front.png
src/assets/buddy/poses/neutral-side.png
src/assets/buddy/poses/neutral-back.png
src/assets/buddy/poses/curious.png
src/assets/buddy/poses/happy.png
src/assets/buddy/poses/proud.png
src/assets/buddy/poses/concerned.png
src/assets/buddy/poses/thinking.png
src/assets/buddy/poses/writing.png
src/assets/buddy/poses/sleeping.png
```

Each generated asset is transparent, 128×128, and lossless PNG.

## Typed asset manifest

Added:

```text
src/assets/buddy/poseManifest.ts
```

The manifest maps every approved pose ID to:

- generated PNG URL;
- alt text;
- logical anchor.

Runtime code does not point at `src/assets/buddy/source/buddy-reference-sheet.png`.

## Pose-selection rules

Added:

```text
src/domain/companion/poseSelection.ts
```

Priority:

1. sleeping activity -> `sleeping`
2. writing activity -> `writing`
3. thinking activity -> `thinking`
4. concerned emotion or alert activity -> `concerned`
5. proud emotion -> `proud`
6. happy emotion -> `happy`
7. curious emotion or looking activity -> `curious`
8. default -> `neutral-front`

The LLM cannot select arbitrary asset filenames.

## Renderer changes

Added:

```text
src/components/buddy/BuddyPoseRenderer.tsx
```

`BuddyRenderer` now uses `BuddyPoseRenderer` by default. The old CSS placeholder remains available
as fallback if a selected pose asset is missing or fails to load.

Renderer behavior:

- uses `<img>`;
- sets `image-rendering: pixelated` and `crisp-edges`;
- disables native image dragging;
- preserves button-based pointer handling for click and drag;
- exposes `data-pose`, `data-emotion`, and `data-activity`;
- keeps transparent desktop background.

## Temporary motion implementation

Static poses are animated with restrained CSS transforms:

- breathing: tiny vertical motion and small scaleY change;
- looking: tiny horizontal shift;
- listening: subtle forward/side lean;
- thinking: slow bob;
- talking: subtle bob and separate chest-core pulse layer;
- writing: tiny bob;
- happy/proud: one restrained bounce;
- sleeping: slow low breathing and small `z` indicator.

Motion can be disabled by renderer props and still respects reduced-motion CSS.

## Companion Lab changes

Companion Lab now supports:

- preview every pose asset;
- preview every emotion;
- preview every activity;
- inspect selected pose ID;
- toggle pose motion;
- toggle reduced motion;
- adjust scale;
- inspect image natural dimensions;
- force a safe missing-asset fallback fixture.

This remains development-only.

## Tests added

- Pose ID coverage and validation.
- Pose-selection priority.
- Manifest contains every required pose.
- Manifest does not point at the source reference sheet.
- Extraction config contains every required pose.
- Extraction rejects unexpected source dimensions.
- Generated assets are 128×128.
- Generated assets have transparent corners.
- Generated assets do not keep opaque grey source-background corners.
- Standing poses share baseline tolerance.
- Sleeping pose uses the lower/wider sleeping layout.
- Renderer selects pose assets.
- Renderer marks reduced-motion state.
- Renderer falls back when an asset is missing.
- Renderer falls back after image load error.

## Commands run

Baseline before art changes:

- `corepack pnpm check` - passed, 19 files / 70 tests
- `cargo test --manifest-path src-tauri/Cargo.toml` - passed, 35 tests

During implementation:

- `corepack pnpm add -D pngjs @types/pngjs` - passed
- `corepack pnpm add -D @types/node` - passed
- `corepack pnpm buddy:extract` - passed
- `corepack pnpm typecheck` - initially failed on strict custom style/indexed access, then passed
- `corepack pnpm lint` - initially failed on strict lint rules, then passed
- `corepack pnpm test` - passed, 23 files / 87 tests

Final verification after all file changes:

- `corepack pnpm check` - passed, including:
  - `corepack pnpm format:check`
  - `corepack pnpm lint`
  - `corepack pnpm typecheck`
  - `corepack pnpm test` - passed, 23 files / 87 tests
- `corepack pnpm build` - passed
- `cargo test --manifest-path src-tauri/Cargo.toml` - passed, 35 tests
- `cargo fmt --manifest-path src-tauri/Cargo.toml --check` - passed
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings` -
  passed
- `git diff --check` - passed, with Windows LF-to-CRLF warnings only
- `corepack pnpm tauri build --debug --no-bundle` - passed
- `corepack pnpm tauri build --no-bundle` - passed

## Manual visual verification

Performed a generated contact-sheet visual check from the ten extracted pose PNGs. Confirmed:

- source-sheet grey background was removed;
- grid separators were absent;
- palette swatches and silhouette were absent;
- antennae were not clipped in the generated contact sheet;
- standing poses appeared consistently aligned;
- sleeping pose appeared lower and wider;
- generated poses retained the intended character design.
- Built and launched the real debug Tauri executable.
- Confirmed the buddy window appears while Companion Home and Bubble remain hidden.
- Captured the visible buddy window and confirmed the extracted PNG character rendered in the real
  desktop buddy window, although Windows transparent-window/DPI capture only showed part of the
  character and should not be treated as complete visual QA.

Full real-desktop visual QA remains pending.

## Observed visual artifacts

- The source art is generated/concept art, so small pose-to-pose inconsistencies remain.
- The pose pack is static; temporary CSS motion is not equivalent to hand-authored animation
  frames.
- Some source shadows/edge pixels may be simplified by conservative background removal.
- Sleeping `z` indicator is source-derived plus a small runtime text indicator; final animation
  should be artist-authored later.

## Files requiring later manual artist cleanup

All generated pose PNGs are temporary and should eventually be replaced by original production
sprites or animation frames:

```text
src/assets/buddy/poses/*.png
```

The source reference sheet remains:

```text
src/assets/buddy/source/buddy-reference-sheet.png
```

## Known limitations

- No final sprite-sheet animation.
- No frame-by-frame mouth animation.
- No production art cleanup.
- No dynamic per-pixel antenna animation.
- No manual real-desktop click/drag/generation visual QA yet.
- No new memory, journal, crypto, cloud, browser-extension, voice, or autonomous trading subsystem.

## Recommended next art milestone

Before broader Part 6 product work, run a human-visible desktop QA pass:

1. Launch the Tauri app.
2. Confirm the extracted character appears in the actual buddy window.
3. Click to open the desktop bubble.
4. Drag the buddy and confirm no image ghost appears.
5. Trigger listening/thinking/talking/happy/concerned/writing/sleeping states from real flows or
   Companion Lab.
6. Confirm reduced motion and fallback behavior.
7. Capture visual issues for a future original production sprite pass.
