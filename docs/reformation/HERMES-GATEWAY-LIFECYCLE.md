# Hermes gateway lifecycle

Date: 2026-07-01

## Launch

Trading Buddy launches the project-pinned gateway directly:

```text
next/agent/venv/Scripts/python.exe -m tui_gateway.entry
```

The process:

- uses `next/agent` as its working directory;
- receives an isolated app-local `HERMES_HOME`;
- receives the `trading-buddy-companion` no-tools profile;
- has stdin, stdout, and stderr piped;
- starts without a visible Windows console;
- has kill-on-drop enabled;
- does not open a network listener.

Stdout is treated as newline-delimited JSON-RPC 2.0 only. Stderr is diagnostic-only and private
content is not copied into application logs.

## Startup

The manager accepts only one live child. Repeated starts reuse the same actor and process ID.
Startup succeeds only after the gateway emits `gateway.ready` within 15 seconds.

Missing submodule/Python paths, spawn errors, malformed JSON, oversized frames, EOF, and startup
timeouts transition to an honest failed/offline state.

## Request routing

Every request:

- uses a generated bounded ID;
- is built from a closed `HermesMethod` enum;
- is limited to 256 KiB;
- has a 30-second response timeout;
- is matched to exactly one pending response;
- cannot forward an arbitrary React-supplied method name.

Gateway events enter a separate bounded channel. Raw gateway payloads are not sent to React.

## Shutdown

On explicit stop, Trading Buddy:

1. closes gateway stdin;
2. waits up to one second for an orderly gateway exit;
3. kills and waits for the child if it does not exit;
4. resolves pending requests as stopped;
5. clears the tracked process ID.

The real S3 smoke test verifies that no `tui_gateway.entry` Python process remains.

## Recovery status

Explicit Retry currently performs a controlled stop/start and increments diagnostics.

The required automatic crash policy—250 ms, one second, three seconds, then failed until explicit
Retry—is reserved for S7. A crash during generation will not be blindly resubmitted; ordered
reconciliation must land in S4 before automatic restart is enabled.
