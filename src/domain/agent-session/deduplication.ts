import type { AgentSessionSnapshot } from './types';
import type { AgentStreamEvent } from './events';

export type AgentEventDisposition = 'accept' | 'duplicate' | 'stale_request' | 'after_terminal';

const terminalStatuses = new Set(['completed', 'cancelled', 'failed']);

export function classifyAgentEvent(
  snapshot: AgentSessionSnapshot,
  event: AgentStreamEvent,
): AgentEventDisposition {
  if (event.sequence <= snapshot.lastSequence) {
    return 'duplicate';
  }
  if (snapshot.activeRequestId !== null && event.requestId !== snapshot.activeRequestId) {
    return 'stale_request';
  }
  if (
    snapshot.activeRequestId === null &&
    event.type !== 'accepted' &&
    event.type !== 'connection_lost' &&
    event.type !== 'connection_restored'
  ) {
    return terminalStatuses.has(snapshot.turnStatus) ? 'after_terminal' : 'stale_request';
  }
  if (terminalStatuses.has(snapshot.turnStatus) && event.type !== 'accepted') {
    return 'after_terminal';
  }
  return 'accept';
}
