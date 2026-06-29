# Task 12B QA Plan - Real Desktop Companion Checkpoint

Date: June 29, 2026

This plan covers the current Task 12B checkpoint for the Hermes/Petdex reformation track under
`next/`. It is not a full completion plan for every requested Task 12B scenario.

## Scope verified by automation

- Pet overlay control routing for:
  - `open-skins`
  - `open-journal`
  - `open-settings`
- Existing pet-state derivation behavior.
- Existing companion-first and window-state native tests.
- Strict TypeScript for the Hermes Desktop workspace.
- Focused ESLint on changed frontend files.

## Manual QA still required

- Launch `corepack pnpm next:dev` on Windows.
- Confirm companion-first startup shows the buddy while the main window stays hidden.
- Single-click buddy and confirm the warm compact bubble opens.
- Type in the bubble and confirm Enter submits while Shift+Enter inserts a newline.
- Right-click buddy and confirm the custom pet menu opens.
- Choose **Change pet skin** and confirm the main window focuses with the existing Petdex gallery.
- Select a different Petdex skin and confirm the buddy updates and persists across relaunch.
- Use tray **Change Pet Skin** and confirm it opens the same Petdex gallery.
- Confirm **Open Journal** focuses the main window and seeds a journal prompt.
- Confirm **Settings**, **Bring Buddy Back**, **Restart Buddy**, and **Quit** behave correctly.
- Repeat on at least one secondary monitor and one DPI scaling value other than 100%.

## Known non-coverage

- No full upstream failure taxonomy validation was performed in this checkpoint.
- No long-running performance sampling was performed.
- No full manual Windows walkthrough was performed by Codex in this pass.
- No final onboarding, installer, migration, wallet, exchange write, cloud, or autonomous trading
  behavior is included.
