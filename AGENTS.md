# Project conventions

## Product boundaries

- Build local-first. User data should remain on the device unless a future feature explicitly and
  transparently requires a remote service.
- Never request, collect, persist, transmit, or log wallet private keys or seed phrases.
- Implement third-party and crypto integrations as read-only before considering write operations.
- Autonomous trading is out of scope unless a future, explicitly approved product decision changes
  that boundary.

## Engineering

- Keep deterministic financial calculations in framework-independent domain modules.
- Validate external data at boundaries. Model output must be treated as untrusted and strictly
  validated before it can affect application state.
- Tests are required for domain logic and meaningful non-native frontend behavior.
- Keep native Tauri capabilities behind narrow service interfaces rather than importing them
  throughout UI components.
- Avoid large dependencies. If one is necessary, document the reason and alternatives considered in
  `docs/DECISIONS.md`.
- Preserve strict TypeScript and do not suppress errors without a documented reason.
- Prefer small, reversible changes with clear ownership between UI, domain, services, and native
  code.

## Verification

Before handing off a change, run:

```powershell
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
cargo test --manifest-path src-tauri/Cargo.toml
```

For native changes, also run a Tauri build or development smoke test.

## Task handoff journal

- At the end of each implementation task, create a concise report for the external task author to
  read. Store task reports under `docs/reports/`.
- Link each completed task report from `docs/PROGRESS.md` so GitHub becomes the durable project
  journal.
- Include what changed, key architecture decisions, commands run, verification results, what could
  not be verified, known limitations, and the recommended next task.
- Push completed task updates to GitHub after the report and journal entry are created, unless the
  user explicitly asks not to push.
