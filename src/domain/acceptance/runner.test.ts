import { describe, expect, it } from 'vitest';
import {
  ACCEPTANCE_STEPS,
  createAcceptanceRun,
  isAcceptanceRun,
  sanitizeAcceptanceNote,
  serializeAcceptanceMarkdown,
  updateAcceptanceResult,
} from './runner';

describe('guided acceptance runner domain', () => {
  it('defines the exact ordered 25-step native walkthrough', () => {
    expect(ACCEPTANCE_STEPS).toHaveLength(25);
    expect(ACCEPTANCE_STEPS.at(0)?.id).toBe('01-launch');
    expect(ACCEPTANCE_STEPS.at(24)?.id).toBe('25-tray-quit');
    expect(createAcceptanceRun(new Date('2026-07-02T10:00:00Z')).results).toHaveLength(25);
  });

  it('redacts credentials and bounds sanitized notes', () => {
    const note = sanitizeAcceptanceNote(
      `Observed token nvapi-${'a'.repeat(80)} and Bearer private.token ${'x'.repeat(700)}`,
    );
    expect(note).not.toContain('nvapi-');
    expect(note).not.toContain('private.token');
    expect(note.length).toBeLessThanOrEqual(500);
  });

  it('keeps human and automatic evidence distinct in export', () => {
    const run = createAcceptanceRun(new Date('2026-07-02T10:00:00Z'));
    const next = updateAcceptanceResult(
      run,
      0,
      {
        status: 'passed',
        evidence: 'human_observed',
        note: 'Observed one native app.',
        diagnostics: null,
      },
      new Date('2026-07-02T10:01:00Z'),
    );
    expect(next.currentStepIndex).toBe(1);
    expect(next.results.at(0)?.evidence).toBe('human_observed');
    expect(serializeAcceptanceMarkdown(next)).toContain('Evidence: **human observed**');
    expect(isAcceptanceRun(next)).toBe(true);
  });

  it('rejects malformed persisted runs', () => {
    const run = createAcceptanceRun();
    expect(isAcceptanceRun({ ...run, results: [] })).toBe(false);
    expect(isAcceptanceRun({ ...run, schemaVersion: 2 })).toBe(false);
  });
});
