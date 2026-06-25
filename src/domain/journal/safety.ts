export interface JournalSafetyResult {
  level: 'normal' | 'serious';
  message: string | null;
  blockMemorySuggestion: boolean;
}

const crisisPatterns = [
  /\bkill myself\b/i,
  /\bend my life\b/i,
  /\bsuicide\b/i,
  /\bi might hurt myself\b/i,
  /\bi am going to hurt myself\b/i,
  /\bcan't stay safe\b/i,
];

export function assessJournalSafety(content: string): JournalSafetyResult {
  if (crisisPatterns.some((pattern) => pattern.test(content))) {
    return {
      level: 'serious',
      message:
        'I’m really glad you said something. If you might be in immediate danger, contact local emergency support now or reach out to a trusted person who can be with you. I can stay here for a short grounding note, but this should not be only between us.',
      blockMemorySuggestion: true,
    };
  }
  return { level: 'normal', message: null, blockMemorySuggestion: false };
}
