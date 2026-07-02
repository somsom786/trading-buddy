export type AgentConnectionStatus =
  | 'stopped'
  | 'starting'
  | 'connecting'
  | 'ready'
  | 'reconnecting'
  | 'offline'
  | 'failed';

export type AgentTurnStatus =
  | 'idle'
  | 'submitting'
  | 'listening'
  | 'thinking'
  | 'streaming'
  | 'completed'
  | 'cancelled'
  | 'failed';

export type CompanionSupportMode = 'listen' | 'reflect' | 'plan' | 'hang_out' | 'presence';

export type AgentMessageStatus =
  | 'pending'
  | 'streaming'
  | 'completed'
  | 'cancelled'
  | 'failed'
  | 'superseded';

export interface AgentSessionError {
  code:
    | 'backend_unavailable'
    | 'provider_unavailable'
    | 'session_not_found'
    | 'request_interrupted'
    | 'request_timeout'
    | 'invalid_response'
    | 'internal_error';
  userMessage: string;
  retryable: boolean;
}

export interface AgentSessionMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  status: AgentMessageStatus;
  requestId?: string;
  sourceUserMessageId?: string;
  attempt?: number;
}

export interface AgentSessionDiagnostics {
  duplicateEventCount: number;
  staleEventCount: number;
  reconnectCount: number;
  latency: AgentLatencyDiagnostics;
}

export interface AgentLatencyDiagnostics {
  clientContextRetrievalMs: number | null;
  clientContextBudgetMs: number | null;
  clientPromptConstructionMs: number | null;
  rustTurnPreparationMs: number | null;
  sessionOpenMs: number | null;
  promptDispatchMs: number | null;
  promptAcceptedAtMs: number | null;
  firstProviderEventAtMs: number | null;
  providerRequestStartedAtMs: number | null;
  firstVisibleContentAtMs: number | null;
  completionReceivedAtMs: number | null;
  sqliteFinalizationMs: number | null;
  crossWindowBroadcastMicros: number | null;
  frontendRenderMs: number | null;
  totalTurnMs: number | null;
}

export interface AgentSessionSnapshot {
  localConversationId: string | null;
  hermesSessionId: string | null;
  hermesSessionKey: string | null;
  connectionStatus: AgentConnectionStatus;
  turnStatus: AgentTurnStatus;
  activeRequestId: string | null;
  activeTurnId: string | null;
  supportMode: CompanionSupportMode;
  temporary: boolean;
  messages: AgentSessionMessage[];
  lastSequence: number;
  recoverableError: AgentSessionError | null;
  diagnostics: AgentSessionDiagnostics;
}

export const INITIAL_AGENT_SESSION_SNAPSHOT: AgentSessionSnapshot = {
  localConversationId: null,
  hermesSessionId: null,
  hermesSessionKey: null,
  connectionStatus: 'stopped',
  turnStatus: 'idle',
  activeRequestId: null,
  activeTurnId: null,
  supportMode: 'reflect',
  temporary: false,
  messages: [],
  lastSequence: 0,
  recoverableError: null,
  diagnostics: {
    duplicateEventCount: 0,
    staleEventCount: 0,
    reconnectCount: 0,
    latency: {
      clientContextRetrievalMs: null,
      clientContextBudgetMs: null,
      clientPromptConstructionMs: null,
      rustTurnPreparationMs: null,
      sessionOpenMs: null,
      promptDispatchMs: null,
      promptAcceptedAtMs: null,
      firstProviderEventAtMs: null,
      providerRequestStartedAtMs: null,
      firstVisibleContentAtMs: null,
      completionReceivedAtMs: null,
      sqliteFinalizationMs: null,
      crossWindowBroadcastMicros: null,
      frontendRenderMs: null,
      totalTurnMs: null,
    },
  },
};
