# Companion latency

This document records content-free timing evidence for Trading Buddy's companion conversation
path. The filename is retained from the original local-model task brief; visible conversation now
uses NVIDIA-hosted DeepSeek V4 Pro. Optional local Ollama use remains limited to continuity work.

## Instrumented spans

Development diagnostics expose durations only. They never store message text, prompt text, memory
context, credentials, tokens, or model reasoning.

| Layer           | Measurements                                                                                                   |
| --------------- | -------------------------------------------------------------------------------------------------------------- |
| Application     | Tauri setup, local context retrieval, context-budget construction, hidden prompt construction                  |
| Gateway/session | process spawn, gateway ready, Rust turn preparation, session create/resume, prompt RPC dispatch and acceptance |
| Provider/model  | exact gateway provider-request marker, first provider event, first visible content, completion                 |
| Persistence     | SQLite terminal finalization                                                                                   |
| Presentation    | Rust emission to Bubble and Home in microseconds, frontend event-to-next-paint in milliseconds                 |

All turn values are elapsed from the Rust submit boundary unless explicitly described as a
standalone duration. The provider-request marker is emitted immediately before the pinned fork
calls the model. It carries only the already validated client request ID.

## July 2, 2026 benchmark

The real-network test used the pinned private gateway, a fresh gateway process and session, the
ignored local credential source, and `deepseek-ai/deepseek-v4-pro`.

| Sample                 | Gateway ready | Session create | Prompt accepted | First visible |  Complete |
| ---------------------- | ------------: | -------------: | --------------: | ------------: | --------: |
| Pre-edit baseline      |        307 ms |         146 ms |           <1 ms |     12,725 ms | 13,028 ms |
| Instrumented sample 1  |        375 ms |         197 ms |           <1 ms |      7,541 ms |  7,804 ms |
| Instrumented sample 2  |        377 ms |         200 ms |           <1 ms |      5,172 ms |  5,755 ms |
| Provider-marker sample |        412 ms |         204 ms |           <1 ms |      5,791 ms |  6,056 ms |

Across these four samples, median first-visible latency was 6,666 ms and the observed range was
5,172-12,725 ms. Gateway readiness remained below the 1.5-second target and prompt acceptance
remained below the 100-ms target.

The historical installed `qwen3:8b` warm result was approximately 17 seconds to first visible
content. The current median is materially lower, but this comparison reflects the already-approved
provider architecture change and machine/network conditions. The timing instrumentation itself is
not claimed as the cause.

## Current attribution

- Trading Buddy's measured gateway startup and prompt acceptance are small relative to the total.
- The direct benchmark currently combines gateway prompt preparation and provider/model wait.
  Native-run diagnostics now split these at the exact `provider.request` marker.
- Rust cross-window and frontend event-to-paint spans are captured by the guided runner during a
  real Bubble/Home stream. They are not inferred from fixture tests.
- SQLite checkpoints remain bounded at 500 new characters; there is no transaction per token.
- Ordinary companion chat retains the no-tools profile and does not attach large tool schemas.
- Immediate Accepted, Listening, Thinking, and Talking lifecycle events remain real state changes;
  no fake tokens, percentages, or fabricated progress are shown.

## Evidence still required

A human must run the native acceptance walkthrough and export diagnostics to record:

- full client context and budget timing for Bubble and Home;
- exact provider-request-to-first-visible latency in the application path;
- Bubble/Home cross-window propagation;
- frontend event-to-paint timing;
- Stop responsiveness under a slow response.

Cloud latency varies by route, load, geography, prompt size, and model behavior. No universal speed
guarantee is claimed.
