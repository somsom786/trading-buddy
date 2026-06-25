import type { JournalKind, JournalSupportMode } from './types';

export interface JournalPrompt {
  id: string;
  text: string;
}

const flows: Record<JournalKind, JournalPrompt[]> = {
  free_reflection: [
    { id: 'mind', text: 'What’s taking up most of your mind right now?' },
    { id: 'feeling', text: 'How did it make you feel?' },
    { id: 'needed', text: 'What do you think you needed in that moment?' },
    { id: 'different', text: 'Is there anything you want to do differently?' },
    { id: 'acknowledged', text: 'Is there anything you simply want acknowledged, not solved?' },
  ],
  daily_check_in: [
    { id: 'feeling', text: 'How are you feeling today?' },
    { id: 'energy', text: 'What’s your energy like?' },
    { id: 'mind', text: 'What’s the main thing on your mind?' },
    { id: 'worthwhile', text: 'What would make today feel worthwhile?' },
    { id: 'support', text: 'Do you want support, accountability, or just company?' },
  ],
  end_of_day_review: [
    { id: 'well', text: 'What went well today?' },
    { id: 'difficult', text: 'What felt difficult?' },
    { id: 'identity', text: 'Did you act like the person or trader you’re trying to become?' },
    { id: 'leave', text: 'What should be left behind tonight?' },
    { id: 'tomorrow', text: 'What’s one intention for tomorrow?' },
  ],
  idea: [
    { id: 'idea', text: 'What’s the idea?' },
    { id: 'who', text: 'Who is it for?' },
    { id: 'problem', text: 'What problem does it solve?' },
    { id: 'now', text: 'Why does it matter now?' },
    { id: 'next', text: 'What’s the smallest next action?' },
  ],
  trading_session: [
    { id: 'intent', text: 'What were you trying to do in the trading session?' },
    { id: 'emotion', text: 'What was your emotional state before trading?' },
    { id: 'risk', text: 'Did you follow your risk rules?' },
    { id: 'proud', text: 'What decision are you proud of?' },
    { id: 'change', text: 'What decision would you change?' },
    { id: 'lesson', text: 'Is the lesson about strategy, discipline, or emotion?' },
  ],
  life: [
    { id: 'share', text: 'Tell me what happened. I’ll stay with the thread.' },
    { id: 'felt', text: 'What part of it is sitting heaviest with you?' },
    { id: 'need', text: 'Do you want this witnessed, understood, or turned into a next step?' },
  ],
  money: [
    { id: 'money', text: 'What money thought or pressure is showing up?' },
    { id: 'feeling', text: 'What feeling is attached to it?' },
    { id: 'choice', text: 'What choice would feel grounded rather than reactive?' },
  ],
  gratitude: [
    { id: 'grateful', text: 'What are you grateful for today?' },
    { id: 'why', text: 'Why did it matter to you?' },
  ],
  decision: [
    { id: 'decision', text: 'What decision are you holding?' },
    { id: 'options', text: 'What options are you seeing?' },
    { id: 'signal', text: 'What would make the decision feel cleaner?' },
  ],
  other: [{ id: 'start', text: 'What do you want to capture?' }],
};

export function journalPromptsForKind(kind: JournalKind): JournalPrompt[] {
  return flows[kind];
}

export function supportModeOpening(mode: JournalSupportMode): string {
  switch (mode) {
    case 'listen':
      return 'I can just listen. No fixing unless you ask.';
    case 'reflect':
      return 'I’ll help notice themes, carefully.';
    case 'plan':
      return 'I’ll help turn your own conclusions into small next steps.';
  }
}
