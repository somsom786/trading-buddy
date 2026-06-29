# Keep, Archive, Replace Plan

Task 12 is a reformation, not a destructive rewrite.

## Keep

- Local-first product boundary.
- No private keys, seed phrases, exchange secrets, order placement, wallet signing, cloud accounts,
  telemetry, or autonomous trading.
- Existing Tauri app as the stable product baseline.
- Existing React domain/UI split.
- Existing local SQLite conversation, memory, journal, and read-only trading foundations.
- Existing buddy art source and extracted temporary pose pack.
- Existing project reports and progress journal.

## Archive by documentation

- The Tauri implementation remains in place, but the reformed Hermes vertical slice lives under
  `next/`.
- Old Task 10 and Task 11 “Shimeji body / Odysseus brain” notes remain historically accurate for
  the Tauri line. They should not be read as the final architecture for the Hermes line.
- The current buddy art remains a development concept, not production animation.

## Replace or evolve

- The long-term desktop shell is being evaluated through the Hermes Desktop fork under
  `next/agent`.
- The long-term pet runtime is Petdex-compatible instead of the current Tauri pose renderer.
- The long-term companion conversation loop uses Hermes sessions with a constrained Trading Buddy
  soul, local model configuration, and a no-tools companion toolset.
- The local-first trader companion identity moves into explicit soul and skill documents under
  `next/packages/trading-buddy-soul` and `next/skills/trader-companion`.

## Do not replace yet

- Do not delete the Tauri application.
- Do not migrate user data automatically.
- Do not wire exchange execution, wallet signing, authentication, or cloud infrastructure.
- Do not add broad native/screen monitoring.
- Do not give the companion tools in the default safe companion mode.
