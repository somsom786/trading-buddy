import { afterEach, describe, expect, it } from 'vitest';
import {
  getLatestAgentRenderMs,
  recordAgentRenderDuration,
  resetAgentRenderTimingForTests,
} from './frontendTiming';

afterEach(() => {
  resetAgentRenderTimingForTests();
});

describe('frontend timing diagnostics', () => {
  it('records only bounded content-free render durations', () => {
    recordAgentRenderDuration(10, 12.345);
    expect(getLatestAgentRenderMs()).toBe(2.35);

    recordAgentRenderDuration(20, 19);
    expect(getLatestAgentRenderMs()).toBe(2.35);

    recordAgentRenderDuration(0, 60_001);
    expect(getLatestAgentRenderMs()).toBe(2.35);
  });
});
