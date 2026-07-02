let latestAgentRenderMs: number | null = null;

export function recordAgentRenderDuration(receivedAt: number, paintedAt: number): void {
  const duration = paintedAt - receivedAt;
  if (Number.isFinite(duration) && duration >= 0 && duration <= 60_000) {
    latestAgentRenderMs = Math.round(duration * 100) / 100;
  }
}

export function getLatestAgentRenderMs(): number | null {
  return latestAgentRenderMs;
}

export function resetAgentRenderTimingForTests(): void {
  latestAgentRenderMs = null;
}
