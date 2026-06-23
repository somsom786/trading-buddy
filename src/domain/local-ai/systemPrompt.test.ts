import { describe, expect, it } from 'vitest';
import { COMPANION_SYSTEM_PROMPT } from './systemPrompt';

describe('companion system prompt', () => {
  it('contains critical safety and identity boundaries', () => {
    expect(COMPANION_SYSTEM_PROMPT).toContain('software companion');
    expect(COMPANION_SYSTEM_PROMPT).toContain('Never pretend to be human or conscious');
    expect(COMPANION_SYSTEM_PROMPT).toContain('Never encourage reckless leverage');
    expect(COMPANION_SYSTEM_PROMPT).toContain('not a therapist or financial adviser');
    expect(COMPANION_SYSTEM_PROMPT).toContain('speaking with a trusted person');
  });
});
