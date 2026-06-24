import { buildConfirmedMemoryContext } from '../domain/memory/context';
import {
  MEMORY_EXTRACTION_SYSTEM_PROMPT,
  buildMemoryExtractionUserPrompt,
  candidateToDraft,
  explicitMemoryCandidate,
  parseMemoryExtractionResponse,
} from '../domain/memory/extraction';
import { detectMemoryIntent } from '../domain/memory/intent';
import { canAutoConfirmMemory, canStoreMemorySensitivity } from '../domain/memory/policy';
import { decideMemoryExtraction } from '../domain/memory/prefilter';
import { safeSecretRefusal } from '../domain/memory/secretDetection';
import type { Memory, MemoryPreferences, RetrievedMemory } from '../domain/memory/types';
import type { LocalChatEvent } from '../domain/local-ai/types';
import type { LocalAiService } from './tauri/localAiService';
import type { StorageService } from './tauri/storageService';

export interface MemoryContextResult {
  context: string | null;
  retrieved: RetrievedMemory[];
  preferences: MemoryPreferences;
}

export interface MemoryProposalResult {
  proposal?: Memory;
  usedOptOut?: 'message' | 'conversation';
  notice?: string;
}

export async function buildMemoryContextForMessage(input: {
  storageService: StorageService;
  content: string;
  temporaryChat: boolean;
}): Promise<MemoryContextResult> {
  const settings = await input.storageService.getSettings();
  const preferences = settings.memoryPreferences;
  if (!preferences.memoryEnabled) {
    return { context: null, retrieved: [], preferences };
  }
  if (input.temporaryChat && !preferences.useMemoriesInTemporaryChat) {
    return { context: null, retrieved: [], preferences };
  }
  const retrieved = await input.storageService.retrieveMemories({
    query: input.content,
    limit: 5,
    includeSensitive: preferences.allowSensitiveMemories,
  });
  return {
    context: buildConfirmedMemoryContext(retrieved),
    retrieved,
    preferences,
  };
}

export async function handleExplicitMemoryIntent(input: {
  storageService: StorageService;
  content: string;
  temporaryChat: boolean;
  sourceConversationId?: string | undefined;
  sourceMessageId?: string | undefined;
  preferences: MemoryPreferences;
}): Promise<MemoryProposalResult> {
  const intent = detectMemoryIntent(input.content);
  if (intent.type === 'disable_memory_for_message') {
    return { usedOptOut: 'message', notice: 'I will not create memory from that message.' };
  }
  if (intent.type === 'disable_memory_for_conversation') {
    return {
      usedOptOut: 'conversation',
      notice: 'Memory proposals are off for this conversation.',
    };
  }
  if (intent.type !== 'remember_explicit') {
    return {};
  }
  if (input.temporaryChat) {
    return {
      notice:
        'Temporary chat cannot create durable memories. Switch back to saved chat if you want Buddy to remember this.',
    };
  }
  const candidate = explicitMemoryCandidate(intent.content);
  if (!candidate) {
    return { notice: safeSecretRefusal() };
  }
  if (!canStoreMemorySensitivity(candidate.sensitivity, input.preferences)) {
    return {
      notice:
        candidate.sensitivity === 'sensitive'
          ? 'Sensitive memory is off. Enable it in What Buddy Knows About Me before saving this.'
          : 'Personal memory is off. Enable it in memory settings before saving this.',
    };
  }
  const duplicate = await findDuplicate(input.storageService, candidate.content);
  if (duplicate) {
    return { proposal: duplicate, notice: 'Buddy already has a similar memory.' };
  }
  const status = canAutoConfirmMemory(candidate.sensitivity, input.preferences)
    ? 'confirmed'
    : 'proposed';
  const proposal = await input.storageService.createMemory(
    candidateToDraft(candidate, {
      status,
      sourceKind: 'user_explicit',
      sourceConversationId: input.sourceConversationId,
      sourceMessageId: input.sourceMessageId,
    }),
  );
  return {
    proposal,
    notice:
      status === 'confirmed'
        ? 'Memory saved. You can edit or delete it anytime.'
        : 'Memory proposal created. Please approve it before Buddy uses it.',
  };
}

export async function runBackgroundMemoryExtraction(input: {
  storageService: StorageService;
  localAiService: LocalAiService;
  content: string;
  model: string;
  requestId: string;
  sourceConversationId?: string | undefined;
  sourceMessageId?: string | undefined;
  temporaryChat: boolean;
  conversationOptedOut: boolean;
  preferences: MemoryPreferences;
}): Promise<Memory | null> {
  const decision = decideMemoryExtraction({
    role: 'user',
    content: input.content,
    temporaryChat: input.temporaryChat,
    memoryEnabled: input.preferences.memoryEnabled,
    conversationOptedOut: input.conversationOptedOut,
    preferences: input.preferences,
  });
  if (!decision.shouldExtract || decision.reason === 'explicit_request') {
    return null;
  }
  const existing = await input.storageService
    .listMemories({ status: 'confirmed', limit: 8 })
    .then((memories) => memories.map((memory) => memory.content));
  let raw = '';
  await input.localAiService.streamChat(
    {
      requestId: input.requestId,
      conversationId: input.sourceConversationId ?? 'memory-extraction',
      model: input.model,
      messages: [
        { role: 'system', content: MEMORY_EXTRACTION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: buildMemoryExtractionUserPrompt({
            userMessage: input.content,
            existingMemories: existing,
            utcDate: new Date().toISOString().slice(0, 10),
          }),
        },
      ],
      think: false,
    },
    (event: LocalChatEvent) => {
      if (event.type === 'content_delta') {
        raw += event.content;
      }
    },
  );
  const candidate = parseMemoryExtractionResponse(raw).find((item) =>
    canStoreMemorySensitivity(item.sensitivity, input.preferences),
  );
  if (!candidate) {
    return null;
  }
  const duplicate = await findDuplicate(input.storageService, candidate.content);
  if (duplicate) {
    return null;
  }
  return input.storageService.createMemory(
    candidateToDraft(candidate, {
      status: canAutoConfirmMemory(candidate.sensitivity, input.preferences)
        ? 'confirmed'
        : 'proposed',
      sourceKind: 'model_proposed',
      sourceConversationId: input.sourceConversationId,
      sourceMessageId: input.sourceMessageId,
    }),
  );
}

async function findDuplicate(
  storageService: StorageService,
  content: string,
): Promise<Memory | null> {
  const matches = await storageService.listMemories({ query: content, limit: 5 });
  const normalized = content.toLocaleLowerCase().replace(/\s+/g, ' ').trim();
  return matches.find((memory) => memory.normalizedContent === normalized) ?? null;
}
