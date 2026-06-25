import { describe, expect, it } from 'vitest';
import {
  buildJournalSummaryPrompt,
  parseDailyReview,
  parseJournalReflection,
  parseJournalSummarySuggestion,
} from './ai';

describe('journal AI boundary parsing', () => {
  it('accepts only bounded strict JSON summary suggestions', () => {
    expect(
      parseJournalSummarySuggestion(
        JSON.stringify({
          title: 'A calmer trading day',
          summary: 'The user noticed less revenge trading and more patience.',
          tags: ['Trading Day', 'process win', 'too-long-tag-with-extra-symbols!!!'],
          tone: 'reflective',
        }),
      ),
    ).toEqual({
      title: 'A calmer trading day',
      summary: 'The user noticed less revenge trading and more patience.',
      tags: ['trading-day', 'process-win'],
      tone: 'reflective',
    });

    expect(parseJournalSummarySuggestion('not json')).toBeNull();
    expect(
      parseJournalSummarySuggestion(
        JSON.stringify({
          title: 'Diagnosis',
          summary: 'This tries to diagnose the user.',
          tags: [],
          tone: 'reflective',
        }),
      ),
    ).toBeNull();
  });

  it('parses reflection and daily review structures without accepting arbitrary prose', () => {
    const reflection = parseJournalReflection(
      JSON.stringify({
        acknowledgement: 'That was a hard session and you still paused.',
        themes: ['risk', 'patience'],
        questions: ['What helped you stop?'],
        possibleNextSteps: ['Write the rule before the first trade.'],
      }),
    );

    const dailyReview = parseDailyReview(
      JSON.stringify({
        date: '2026-06-25',
        highlights: ['Stopped on time'],
        difficulties: ['Felt rushed'],
        recurringThemes: ['patience'],
        processWins: ['Reviewed risk'],
        possibleFocusForTomorrow: ['Trade smaller'],
      }),
    );

    expect(reflection?.questions).toEqual(['What helped you stop?']);
    expect(dailyReview?.date).toBe('2026-06-25');
  });

  it('bounds prompt input before handing it to a model', () => {
    const prompt = buildJournalSummaryPrompt('x'.repeat(9_000));
    expect(prompt).toContain('x'.repeat(8_000));
    expect(prompt.length).toBeLessThan(8_200);
  });
});
