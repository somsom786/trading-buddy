export type CompanionConversationMode = 'listen' | 'reflect' | 'plan' | 'hang_out' | 'presence';

export interface DetectedConversationMode {
  mode: CompanionConversationMode;
  reasonCode:
    | 'explicit_listen_request'
    | 'explicit_reflection_request'
    | 'explicit_planning_request'
    | 'explicit_casual_request'
    | 'explicit_presence_request'
    | 'default_reflection';
}

export function detectConversationMode(input: string): DetectedConversationMode {
  const normalized = input.toLocaleLowerCase().replace(/\s+/g, ' ').trim();

  if (
    /\b(just listen|only listen|don't (give|offer) (me )?advice|no advice|let me vent)\b/.test(
      normalized,
    )
  ) {
    return { mode: 'listen', reasonCode: 'explicit_listen_request' };
  }
  if (
    /\b(sit (with|near|nearby)|stay (with|near|nearby)|quietly nearby|keep me company quietly)\b/.test(
      normalized,
    )
  ) {
    return { mode: 'presence', reasonCode: 'explicit_presence_request' };
  }
  if (/\b(hang out|chill|casual chat|keep me company|shoot the breeze)\b/.test(normalized)) {
    return { mode: 'hang_out', reasonCode: 'explicit_casual_request' };
  }
  if (
    /\b(make|build|help me with|give me)\b.{0,24}\b(plan|steps|checklist)\b/.test(normalized) ||
    /\bwhat should i do next\b/.test(normalized)
  ) {
    return { mode: 'plan', reasonCode: 'explicit_planning_request' };
  }
  if (
    /\b(reflect|help me think|talk this through|what am i missing|mirror this back)\b/.test(
      normalized,
    )
  ) {
    return { mode: 'reflect', reasonCode: 'explicit_reflection_request' };
  }
  return { mode: 'reflect', reasonCode: 'default_reflection' };
}

export function conversationModePrompt(detected: DetectedConversationMode): string {
  const shared =
    'CONVERSATION MODE\nFollow the user-selected mode without overriding direct user instructions.';
  const prompts: Record<CompanionConversationMode, string> = {
    listen:
      'Listen. Acknowledge and ask at most one gentle question. Do not give solutions, plans, or advice unless the user changes the request.',
    reflect:
      'Reflect carefully. Name patterns as tentative observations, preserve uncertainty, and avoid inventing motives or outcomes.',
    plan: 'Help the user make a small user-owned plan. Separate known facts from assumptions and keep financial decisions with the user.',
    hang_out:
      'Keep this casual and warm. Do not force productivity, trading talk, or a list of actions.',
    presence:
      'Be quietly present. Keep the response minimal, do not interrogate, and do not claim to monitor the screen or surroundings.',
  };
  return `${shared}\nMode: ${detected.mode}\nReason: ${detected.reasonCode}\n${prompts[detected.mode]}`;
}
