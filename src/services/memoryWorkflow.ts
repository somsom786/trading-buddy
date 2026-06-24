import { buildConfirmedMemoryContext } from '../domain/memory/context';
import { classifyMemoryConflict } from '../domain/memory/conflicts';
import {
  MEMORY_EXTRACTION_SYSTEM_PROMPT,
  buildMemoryExtractionUserPrompt,
  candidateToDraft,
  explicitMemoryCandidate,
  parseMemoryExtractionResponse,
} from '../domain/memory/extraction';
import { resolveForgetRequest } from '../domain/memory/forgetting';
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

export interface MemoryForgetResult {
  deletedMemory?: Memory;
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
  const draft = candidateToDraft(candidate, {
    status,
    sourceKind: 'user_explicit',
    sourceConversationId: input.sourceConversationId,
    sourceMessageId: input.sourceMessageId,
  });
  const existing = await input.storageService.listMemories({ status: 'confirmed', limit: 25 });
  const relationship = classifyMemoryConflict({ candidate: draft, existing });
  if (relationship.relationship === 'conflict') {
    return {
      notice:
        'That sounds related to an existing memory but may contradict it. Please review memories before replacing anything.',
    };
  }
  const proposal =
    relationship.relationship === 'update' && relationship.existingMemory
      ? status === 'confirmed'
        ? await input.storageService.supersedeMemory({
            previousMemoryId: relationship.existingMemory.id,
            replacement: draft,
          })
        : await input.storageService.createMemory({
            ...draft,
            supersedesMemoryId: relationship.existingMemory.id,
          })
      : await input.storageService.createMemory(draft);
  return {
    proposal,
    notice:
      relationship.relationship === 'update'
        ? status === 'confirmed'
          ? 'Memory updated. The older version was superseded.'
          : 'Memory update proposal created. Confirm it before Buddy replaces the old version.'
        : status === 'confirmed'
          ? 'Memory saved. You can edit or delete it anytime.'
          : 'Memory proposal created. Please approve it before Buddy uses it.',
  };
}

export async function handleForgetMemoryIntent(input: {
  storageService: StorageService;
  content: string;
}): Promise<MemoryForgetResult> {
  const intent = detectMemoryIntent(input.content);
  if (intent.type !== 'forget_explicit') {
    return {};
  }
  const memories = await input.storageService.listMemories({ status: 'confirmed', limit: 100 });
  const resolution = resolveForgetRequest({ query: intent.query, memories });
  switch (resolution.kind) {
    case 'exact':
      await input.storageService.deleteMemory(resolution.memory.id);
      return {
        deletedMemory: resolution.memory,
        notice: `Forgot: ${resolution.memory.content}`,
      };
    case 'ambiguous':
      return {
        notice: `I found ${String(
          resolution.matches.length,
        )} possible memories. Please open What Buddy Knows About Me and delete the exact one.`,
      };
    case 'category':
      return {
        notice: `I found ${String(
          resolution.matches.length,
        )} ${resolution.category.replaceAll('_', ' ')} memories. Please confirm deletions in What Buddy Knows About Me.`,
      };
    case 'all':
      return {
        notice:
          'That would delete all memories. Please use Delete all memories in What Buddy Knows About Me so it is deliberate.',
      };
    case 'not_found':
      return { notice: resolution.reason };
  }
}

async function createMemoryFromCandidate(input: {
  storageService: StorageService;
  candidate: ReturnType<typeof parseMemoryExtractionResponse>[number];
  preferences: MemoryPreferences;
  sourceConversationId?: string | undefined;
  sourceMessageId?: string | undefined;
  sourceKind: 'user_explicit' | 'model_proposed';
}): Promise<Memory | null> {
  const status = canAutoConfirmMemory(input.candidate.sensitivity, input.preferences)
    ? 'confirmed'
    : 'proposed';
  const draft = candidateToDraft(input.candidate, {
    status,
    sourceKind: input.sourceKind,
    sourceConversationId: input.sourceConversationId,
    sourceMessageId: input.sourceMessageId,
  });
  const existing = await input.storageService.listMemories({ status: 'confirmed', limit: 25 });
  const relationship = classifyMemoryConflict({ candidate: draft, existing });
  if (relationship.relationship === 'duplicate' || relationship.relationship === 'conflict') {
    return null;
  }
  if (relationship.relationship === 'update' && relationship.existingMemory) {
    if (status === 'confirmed') {
      return input.storageService.supersedeMemory({
        previousMemoryId: relationship.existingMemory.id,
        replacement: draft,
      });
    }
    return input.storageService.createMemory({
      ...draft,
      supersedesMemoryId: relationship.existingMemory.id,
    });
  }
  return input.storageService.createMemory(draft);
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
  return createMemoryFromCandidate({
    storageService: input.storageService,
    candidate,
    preferences: input.preferences,
    sourceKind: 'model_proposed',
    sourceConversationId: input.sourceConversationId,
    sourceMessageId: input.sourceMessageId,
  });
}

async function findDuplicate(
  storageService: StorageService,
  content: string,
): Promise<Memory | null> {
  const matches = await storageService.listMemories({ query: content, limit: 5 });
  const normalized = content.toLocaleLowerCase().replace(/\s+/g, ' ').trim();
  return matches.find((memory) => memory.normalizedContent === normalized) ?? null;
}
