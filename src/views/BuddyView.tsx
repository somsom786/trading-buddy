import { useEffect, useRef, useState } from 'react';
import { BuddyRenderer } from '../components/buddy/BuddyRenderer';
import { BuddyStatusIndicator } from '../components/buddy/BuddyStatusIndicator';
import { decideAmbientLife } from '../domain/companion/ambientLife';
import { buddyStateToVisualState, type BuddyState } from '../domain/companion/buddyState';
import type { BuddyVisualState } from '../domain/companion/visualState';
import { tauriCompanionService, type CompanionService } from '../services/tauri/companionService';
import { tauriWindowService, type WindowService } from '../services/windowService';

interface BuddyViewProps {
  windowService?: WindowService;
  companionService?: CompanionService;
}

export function BuddyView({
  windowService = tauriWindowService,
  companionService = tauriCompanionService,
}: BuddyViewProps) {
  const [state, setState] = useState<BuddyState>('idle');
  const [visualState, setVisualState] = useState<BuddyVisualState>(buddyStateToVisualState('idle'));
  const lastInteractionRef = useRef(0);

  useEffect(() => {
    let disposed = false;
    let cleanup: () => void = () => undefined;
    void companionService
      .subscribe((command) => {
        if (command.type === 'set_state') {
          setState(command.state);
          setVisualState(buddyStateToVisualState(command.state));
        } else if (command.type === 'wake') {
          setState('idle');
          setVisualState({ emotion: 'curious', activity: 'waking' });
        } else if (command.type === 'do_not_disturb') {
          setState('sleeping');
          setVisualState({ emotion: 'sleepy', activity: 'sleeping' });
        }
      })
      .then((unlisten) => {
        if (disposed) {
          unlisten();
        } else {
          cleanup = unlisten;
        }
      });
    return () => {
      disposed = true;
      cleanup();
    };
  }, [companionService]);

  useEffect(() => {
    let disposed = false;
    let timeout: number | null = null;
    if (lastInteractionRef.current === 0) {
      lastInteractionRef.current = Date.now();
    }
    const reducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const schedule = async () => {
      const priority =
        state === 'error' ? 'alert' : state === 'idle' ? 'ambient' : 'active_conversation';
      const osIdleSeconds = await windowService.getOsIdleSeconds().catch(() => 0);
      if (disposed) {
        return;
      }
      const decision = decideAmbientLife(
        { priority, current: visualState, osIdleSeconds },
        {
          enabled: true,
          reducedMotion,
          sleepAfterInactivitySeconds: 900,
          nowMs: Date.now(),
          lastUserInteractionMs: lastInteractionRef.current,
          rng: Math.random,
        },
      );
      if (decision.reason !== 'paused') {
        setVisualState(decision.state);
        setState(decision.state.activity === 'sleeping' ? 'sleeping' : 'idle');
      }
      timeout = window.setTimeout(() => {
        void schedule();
      }, decision.nextDelayMs);
    };

    timeout = window.setTimeout(() => {
      void schedule();
    }, 1_200);
    return () => {
      disposed = true;
      if (timeout !== null) {
        window.clearTimeout(timeout);
      }
    };
  }, [state, visualState, windowService]);

  const toggleBubble = () => {
    lastInteractionRef.current = Date.now();
    void companionService.emitInteraction({ type: 'interaction_detected' });
    void companionService.emitInteraction({ type: 'buddy_clicked' });
    setState('happy');
    setVisualState({ emotion: 'curious', activity: 'waking' });
    void windowService.toggleCompanionBubble();
  };

  return (
    <main className="buddy-view" data-testid="buddy-view">
      <BuddyRenderer
        state={state}
        visualState={visualState}
        companionService={companionService}
        onActivate={toggleBubble}
        onHoverStart={() => {
          lastInteractionRef.current = Date.now();
          if (state !== 'sleeping') {
            setVisualState({ emotion: 'curious', activity: 'looking' });
          }
        }}
        onHoverEnd={() => {
          if (state !== 'sleeping') {
            setVisualState(buddyStateToVisualState(state));
          }
        }}
      />
      <BuddyStatusIndicator state={state} />
    </main>
  );
}
