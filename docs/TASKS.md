# Tasks

## Foundation

- [x] Scaffold Tauri 2, React, TypeScript, and Vite.
- [x] Configure pnpm and quality tooling.
- [x] Add buddy and main windows.
- [x] Add tray actions.
- [x] Persist buddy position locally.
- [x] Add foundation tests and documentation.

## Task 2 — First Living Local Companion

- [x] Preserve existing Tauri windows, tray, focus behavior, and buddy position persistence.
- [x] Detect local Ollama through a Rust-side loopback client.
- [x] List and select locally installed models.
- [x] Prefer the centrally configured `qwen3:4b` model when installed.
- [x] Stream native Ollama chat responses through a Tauri channel.
- [x] Parse partial, multiple, blank, malformed, and final NDJSON records safely.
- [x] Add typed errors, request validation, timeouts, and cancellation.
- [x] Keep conversation state session-only.
- [x] Add deterministic buddy lifecycle states and reduced-motion CSS.
- [x] Add centralized validated cross-window contracts.
- [x] Prevent buddy dragging from opening the main window.
- [x] Add development-only Buddy Lab and mock streaming.
- [x] Add frontend and Rust tests for domain and integration boundaries.
- [x] Verify real Qwen inference and cancellation against a running local Ollama instance.
- [x] Verify closing the main window keeps the buddy alive and the buddy reopens main.
- [x] Re-verify buddy position persistence after Task 2 native changes.
- [ ] Manually click all tray items after Task 2 changes.

Task 2 implementation and automated checks are complete. Native inference, cancellation,
close/reopen behavior, tray-icon presence, and position persistence were verified on Windows. The
three tray menu items still require a direct manual click-through because desktop automation could
not reliably activate the overflow menu.

## Next — requires separate product approval

- [ ] Design a local persistence schema for journal and settings data.
- [ ] Add navigation state and empty feature routes.
- [ ] Define validated domain types for journal entries and reviews.
- [ ] Create threat models for read-only exchange integrations.
- [ ] Evaluate an optional model boundary with strict structured-output validation.
- [ ] Add accessibility and multi-monitor window behavior testing.

The unchecked items are planning notes, not authorization to implement integrations or model
features.
