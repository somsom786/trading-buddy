import { describe, expect, it } from 'vitest';
import {
  readableConversationTime,
  summarizeDatabaseLocation,
  summarizeExportDestination,
} from './display';

const now = new Date('2026-06-23T12:00:00Z');

describe('storage display helpers', () => {
  it('formats recent conversation timestamps', () => {
    expect(
      readableConversationTime(
        { updatedAt: '2026-06-23T11:59:30Z', lastMessageAt: '2026-06-23T11:59:30Z' },
        now,
      ),
    ).toBe('Just now');
    expect(readableConversationTime({ updatedAt: '2026-06-23T11:45:00Z' }, now)).toBe('15m ago');
    expect(readableConversationTime({ updatedAt: '2026-06-23T09:00:00Z' }, now)).toBe('3h ago');
    expect(readableConversationTime({ updatedAt: '2026-06-21T12:00:00Z' }, now)).toBe('2d ago');
  });

  it('handles invalid timestamps safely', () => {
    expect(readableConversationTime({ updatedAt: 'not-a-date' }, now)).toBe('Unknown time');
  });

  it('summarizes database and export locations without requiring full private paths', () => {
    expect(
      summarizeDatabaseLocation({
        databaseFileName: 'trading-buddy.db',
        databaseLocationSummary: 'com.tradingbuddy.desktop\\trading-buddy.db',
      }),
    ).toBe('com.tradingbuddy.desktop\\trading-buddy.db');
    expect(summarizeDatabaseLocation(null)).toBe('Unavailable');
    expect(summarizeExportDestination({ fileName: 'qa-export.json' })).toBe('qa-export.json');
  });
});
