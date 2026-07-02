import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { INITIAL_AGENT_SESSION_SNAPSHOT } from '../../domain/agent-session/types';
import { createFakeAgentSessionService } from '../../test/fakeAgentSessionService';
import { AgentSessionLab } from './AgentSessionLab';

describe('AgentSessionLab', () => {
  it('routes safe crash simulation through the owned gateway service', async () => {
    const user = userEvent.setup();
    const { service } = createFakeAgentSessionService();
    const simulateGatewayCrash = vi.fn().mockResolvedValue(undefined);
    service.simulateGatewayCrash = simulateGatewayCrash;
    render(<AgentSessionLab snapshot={INITIAL_AGENT_SESSION_SNAPSHOT} service={service} />);

    await user.click(screen.getByText('Agent Session Lab'));
    await user.click(screen.getByRole('button', { name: 'Crash backend safely' }));

    expect(simulateGatewayCrash).toHaveBeenCalledOnce();
  });

  it('shows a bounded development-action failure instead of leaking an unhandled rejection', async () => {
    const user = userEvent.setup();
    const { service } = createFakeAgentSessionService();
    service.simulateGatewayCrash = vi.fn().mockRejectedValue(new Error('Gateway is not running.'));
    render(<AgentSessionLab snapshot={INITIAL_AGENT_SESSION_SNAPSHOT} service={service} />);

    await user.click(screen.getByText('Agent Session Lab'));
    await user.click(screen.getByRole('button', { name: 'Crash backend safely' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Gateway is not running.');
  });
});
