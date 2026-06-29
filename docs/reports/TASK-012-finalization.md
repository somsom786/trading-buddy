# Task 12 Finalization Report

Date: June 29, 2026

## Summary

This checkpoint finishes the feasible Task 12 reformation foundation work: the Hermes/Petdex
preview remains reversible under `next/`, the buddy/Petdex path is documented, desktop lint/format
tooling is now clean on Windows, developer packaging is documented, and the migration strategy is
explicitly implemented as isolation/no automatic migration for this preview stage.

This does not claim human multi-monitor QA or a production installer.

## What changed

- Fixed the Hermes Desktop `fmt` script so it runs correctly on Windows shells.
- Cleaned the remaining Hermes Desktop lint blockers.
- Kept the existing Task 12B Petdex skin/buddy UI branch as the active reformation branch.
- Added developer packaging documentation for the reformation preview.
- Updated QA/reporting docs to distinguish closed checks from pinned upstream full-suite failures.
- Reframed migration as an explicit no-automatic-migration strategy for Task 12.

## Architecture decisions

- The preserved Tauri baseline remains the stable app.
- The Hermes/Petdex preview remains isolated under `next/`.
- No automatic Tauri-to-Hermes migration runs in Task 12. This is intentional: the preview uses an
  isolated Hermes profile so no existing Tauri user data is touched.
- Petdex remains the canonical pet skin runtime for the preview.
- Developer packaging means local build/unpacked package, not signed installer distribution.

## Commands run

```powershell
npm run fmt --workspace apps/desktop
npm run lint --workspace apps/desktop
npm run typecheck --workspace apps/desktop
npm run test:ui --workspace apps/desktop
npm run test:desktop:platforms --workspace apps/desktop
npm run build --workspace apps/desktop
npm run pack --workspace apps/desktop
corepack pnpm next:check
```

## Verification results

- `npm run fmt --workspace apps/desktop`: passed after fixing the Windows quoting bug.
- `npm run lint --workspace apps/desktop`: passed.
- `npm run typecheck --workspace apps/desktop`: passed.
- `npm run build --workspace apps/desktop`: passed, including Vite build and `assert-dist-built`.
- `npm run pack --workspace apps/desktop`: passed and produced
  `next/agent/apps/desktop/release/win-unpacked/Trading Buddy.exe`.
- `corepack pnpm next:check`: passed, including Petdex pack build and 3 manifest tests.

## Pinned upstream failures

These remain outside the Task 12 reformation finish:

- `npm run test:ui --workspace apps/desktop` still fails on existing Hermes UI tests unrelated to
  this checkpoint, including assistant rendering, pane width override, preview routing,
  attachments, model settings, messaging, and tool fallback tests.
- `npm run test:desktop:platforms --workspace apps/desktop` passes most platform tests but still
  fails existing update-relaunch tests on this Windows/bash path combination.

## Could not be fully verified

- Human multi-monitor/DPI walkthrough.
- Pet skin persistence across a real desktop relaunch after manual selection.
- Signed production installer.
- Automatic data migration, intentionally out of scope for this preview stage.

## Recommended next task

Run the human Task 12B Windows walkthrough on the actual desktop:

1. launch `corepack pnpm next:dev`;
2. switch Petdex skins from the buddy/menu/tray;
3. relaunch and confirm persistence;
4. test on the second monitor and DPI variants;
5. decide whether to fix or explicitly quarantine the broader upstream Hermes UI test suite before
   productizing the Hermes runtime.
