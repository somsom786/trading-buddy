# Task 12D — DeepSeek cloud provider and public vision

**Date:** July 2, 2026

**Status:** Implementation complete; generation endpoint did not complete during live verification

**Follow-up:** Task 12E switched the active route to working V4 Pro. See
[`TASK-012E-deepseek-v4-pro-switch.md`](TASK-012E-deepseek-v4-pro-switch.md).

## Outcome

Trading Buddy's visible companion conversation is now pinned to
`deepseek-ai/deepseek-v4-flash` through NVIDIA's hosted OpenAI-compatible endpoint. The
project-owned Tauri/React frontend remains the only product UI; the Hermes-derived fork remains
backend/session logic only.

The repository now opens with a Vision link and project-owned concept art. A root `VISION.md`
describes the intended taskbar/edge companion, attached bubble, support modes, visual direction,
concrete use flow, current reality, and product boundaries.

## What changed

- Added a Rust-owned NVIDIA provider configuration with thinking enabled, high reasoning effort,
  temperature `1`, top-p `0.95`, and a 16,384-token output ceiling.
- Ignored `nvidia-api.txt`, `.env.local`, and `*.api-key`.
- Added credential loading from `NVIDIA_API_KEY`,
  `TRADING_BUDDY_NVIDIA_API_KEY_FILE`, app-local `nvidia-api.txt`, or the ignored project
  development file.
- Validated that exactly one `nvapi-...` token is present; multiple or malformed credentials fail
  closed.
- Passed the credential only to the private backend subprocess environment. Generated YAML,
  SQLite, React state, diagnostics, and Git never receive the key.
- Ignored frontend-supplied model choices at the native boundary and pinned both new and resumed
  companion sessions to the selected cloud route.
- Replaced visible Ollama/model-selection messaging with a cloud-provider status and explicit
  privacy disclosure.
- Kept Ollama optional for local embeddings and background memory extraction; it no longer gates
  visible conversation.
- Updated tests, README, Product, MVP, Architecture, Decisions, and the progress journal.

## Architecture decisions

- Rust owns model/provider routing. React cannot select an arbitrary inference endpoint.
- Rust-owned SQLite remains authoritative for visible transcripts and lifecycle state.
- Messages and selected bounded context leave the device for inference; durable application data
  remains local.
- The backend/session fork has no visible branding, navigation, or frontend ownership.
- Development file credentials are temporary. Production distribution requires operating-system
  credential storage.

## Live API evidence

- Authenticated `GET /v1/models`: HTTP 200 in 211 ms.
- The requested model was present in the authenticated model catalog.
- Minimal direct generation without thinking overrides: no response headers before a 90,182 ms
  timeout.
- Direct generation matching the requested parameters: no response before a 120,046 ms timeout.
- Full Rust → private gateway → NVIDIA stream: no visible event before the 180-second integration
  timeout.
- Repeating the full app-path test with the replacement ignored-file credential produced the same
  180-second timeout; the credential itself remained unprinted and uncommitted.

Credential authentication, model discovery, local provider configuration, gateway startup, and
request dispatch were verified. A generation-speed result could not be measured because NVIDIA's
model route did not return during the test window.

## Verification

- `pnpm format:check` — passed.
- `pnpm lint` — passed.
- `pnpm typecheck` — passed.
- `pnpm test` — 183 passed.
- `cargo test --manifest-path src-tauri/Cargo.toml` — 99 passed, one live-network test ignored by
  default.
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings`
  — passed after one mechanical `contains` correction.
- `pnpm build` — passed.
- `pnpm tauri build --no-bundle` — passed; release executable produced.

## Could not be verified

- First token and completed-response latency for DeepSeek V4 Flash.
- A complete real assistant response in the Bubble or Companion Home.
- Stop/retry behavior against an actively streaming NVIDIA response.
- Interactive Windows visual QA for the updated provider panel.

## Security note

The supplied development credential was not committed or printed. Because a credential was pasted
into conversation earlier, it should be revoked and replaced before continued development.

## Recommended next task

Rotate the NVIDIA key, repeat the bounded live stream test, and investigate NVIDIA endpoint
availability or account-level model access if generation still hangs. Do not add new product
features until one complete Bubble response streams and stop/retry are re-verified against the
cloud route.
