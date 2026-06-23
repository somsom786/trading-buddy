import { describe, expect, it } from 'vitest';
import { resolveAppView } from './view';

describe('resolveAppView', () => {
  it('selects the buddy view when requested', () => {
    expect(resolveAppView('?view=buddy')).toBe('buddy');
  });

  it.each(['', '?view=main', '?view=unknown'])('defaults %s to the main view', (search) => {
    expect(resolveAppView(search)).toBe('main');
  });
});
