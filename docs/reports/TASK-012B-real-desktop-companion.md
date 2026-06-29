# Task 12B Report - Petdex Skins and Buddy UI Checkpoint

Date: June 29, 2026

## Summary

This checkpoint improves the Hermes/Petdex reformation preview by making pet skin selection visible
from the desktop buddy and by replacing the tiny overlay input with a warmer, pet-first bubble and
custom menu.

This is not full Task 12B completion. It is a scoped checkpoint focused on Petdex skins and UI
direction.

## What changed

- Added a real buddy entry point to the existing Petdex skin chooser.
- Added **Change Pet Skin** to the companion tray.
- Added new overlay control messages for skins, journal, settings, bring-back, restart, and quit.
- Routed pet menu actions through the main Hermes renderer instead of adding duplicate UI state.
- Reworked the detached pet overlay into a warm, compact Trading Buddy bubble.
- Added a custom right-click pet menu with game-like actions.
- Warmed the status bubble copy and styling.
- Added a focused Vitest for overlay menu routing.
- Added Task 12B QA, pet experience, upstream baseline, and report docs.

## Architecture choices

- Petdex remains canonical for skins. The buddy opens the existing Petdex gallery; it does not own a
  parallel skin selector.
- The overlay remains a puppet window. It mirrors pet state and sends narrow controls back to the
  main renderer.
- The UI foundation is intentionally small: one overlay CSS file with design tokens and local
  bubble/menu/button primitives.
- Journal routing is intentionally transitional because the Hermes reformation track has not yet
  migrated the preserved Tauri journal surface.

## Commands run

```powershell
npm run fmt --workspace apps/desktop
npm run typecheck --workspace apps/desktop
npx vitest run --environment jsdom src/store/pet-overlay.test.ts src/store/pet.test.ts
node --test electron/companion-mode.test.cjs electron/window-state.test.cjs
npx eslint src/app/desktop-controller.tsx src/app/pet-overlay/pet-overlay-app.tsx src/components/pet/pet-bubble.tsx src/store/pet-overlay.ts src/store/pet-overlay.test.ts
npm run lint --workspace apps/desktop
corepack pnpm next:check
npm run build --workspace apps/desktop
```

## Verification results

- TypeScript: passed.
- Focused Vitest: passed, 2 files and 7 tests.
- Focused native tests: passed, 18 tests.
- Focused ESLint on changed frontend files: passed.
- Reformation Petdex pack/check: passed, 3 manifest tests.
- Hermes Desktop production build: passed, including `assert-dist-built`.

## Could not be fully verified

- `npm run fmt --workspace apps/desktop` exits on Windows because the script treats the quoted
  `vite.config.ts` pattern literally.
- Full `npm run lint --workspace apps/desktop` still fails on unrelated upstream Hermes lint issues.
- Desktop build emitted existing warnings for a large bundle, a generated CSS optimizer warning, and
  a dirty-tree build stamp because the checkpoint was not committed yet.
- No real Windows desktop launch/manual walkthrough was completed in this checkpoint.
- Pet skin persistence after relaunch still needs manual verification.
- Full Task 12B upstream failure taxonomy, safe/offline modes, performance matrix, and multi-monitor
  QA remain open.

## Known limitations

- Sleep and quiet are overlay-local status flags only.
- The compact bubble does not yet render a full streaming assistant transcript.
- Journal is a seeded main composer entry point until the Tauri journal surface is migrated or a
  Hermes-native journal surface is created.

## Recommended next task

Run a real Windows `corepack pnpm next:dev` walkthrough and close the manual QA gaps for:

1. skin switching and persistence;
2. bubble/menu interactions;
3. tray commands;
4. multi-monitor and DPI behavior;
5. upstream lint baseline ownership.
