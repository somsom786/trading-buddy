# Task 7 Memory QA Plan

Date: 2026-06-24

## Baseline before implementation

- `corepack pnpm check` passed.
- `cargo test --manifest-path src-tauri/Cargo.toml` passed.
- No pre-existing automated failures were observed before Task 7 changes.

## Manual desktop QA targets

Use the actual Tauri desktop app and a locally installed Qwen model. Do not use mocked streaming for these checks.

1. Create an explicit memory with “remember that…”.
2. Confirm it from the proposal UI.
3. Start a new conversation and ask a related question.
4. Verify the memory-used indicator appears only when the memory is retrieved.
5. Ask Buddy to update a related memory and verify the old memory is superseded or requires review.
6. Ask Buddy to forget one exact memory and verify it is deleted only after a clear match.
7. Ask Buddy to forget an ambiguous group and verify it requests clarification instead of deleting broadly.
8. Verify temporary chats do not create durable memories unless settings explicitly allow retrieval there.
9. Export memories with sensitive export disabled and verify sensitive records are excluded.
10. Delete all memories and verify conversation history remains.
11. Restart the app and verify memory state persists correctly.

## Automated QA targets

- Domain tests for conflict classification.
- Domain tests for natural-language forgetting resolution.
- Domain tests for retrieval context clarity and deterministic ordering.
- Frontend tests for proposal/notice behavior where feasible without native APIs.
- Rust storage tests for superseding, restore/expiry updates, diagnostics, fixture cleanup, retrieval reason codes, and export privacy.

## Performance checks

- Generate 100 local development fixture memories and verify list/retrieval remain responsive.
- Generate 1,000 local development fixture memories and verify retrieval remains bounded and the Memory Lab does not render all full memory bodies at once.
- Record timings in the Task 7 QA journal.

## Safety checks

- No private keys, seed phrases, or secret-shaped content can be stored.
- Sensitive memory remains opt-in and excluded from default retrieval/export.
- Development fixtures are clearly marked and removable.
- Memory Lab is development-only and must not become a production dashboard.
