import { useEffect, useRef, useState } from 'react';
import { BuddyRenderer } from '../components/buddy/BuddyRenderer';
import { BuddyStatusIndicator } from '../components/buddy/BuddyStatusIndicator';
import { decideAmbientLife } from '../domain/companion/ambientLife';
import { buddyStateToVisualState, type BuddyState } from '../domain/companion/buddyState';
import type { BuddyVisualState } from '../domain/companion/visualState';
import type { CreatureLocomotion } from '../domain/creature/types';
import type { CreatureAnimationIntent } from '../domain/creature/animation';
import type { CreatureMovementPreferences } from '../domain/creature/preferences';
import type { CompanionPreferences } from '../domain/storage/types';
import { DesktopCreatureRuntime } from '../services/creatureRuntime';
import { tauriCompanionService, type CompanionService } from '../services/tauri/companionService';
import {
  tauriDesktopWorldService,
  type DesktopWorldService,
} from '../services/tauri/desktopWorldService';
import { tauriStorageService, type StorageService } from '../services/tauri/storageService';
import { tauriWindowService, type WindowService } from '../services/windowService';

interface BuddyViewProps {
  windowService?: WindowService;
  companionService?: CompanionService;
  desktopWorldService?: DesktopWorldService;
  storageService?: Pick<StorageService, 'getSettings'>;
}

export function BuddyView({
  windowService = tauriWindowService,
  companionService = tauriCompanionService,
  desktopWorldService = tauriDesktopWorldService,
  storageService = tauriStorageService,
}: BuddyViewProps) {
  const [state, setState] = useState<BuddyState>('idle');
  const [visualState, setVisualState] = useState<BuddyVisualState>(buddyStateToVisualState('idle'));
  const [locomotion, setLocomotion] = useState<CreatureLocomotion>('idle');
  const [animationIntent, setAnimationIntent] = useState<CreatureAnimationIntent | null>(null);
  const lastInteractionRef = useRef(0);
  const creatureRuntimeRef = useRef<DesktopCreatureRuntime | null>(null);
  const renderCountRef = useRef(0);

  useEffect(() => {
    renderCountRef.current += 1;
  });

  useEffect(() => {
    const reducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const runtime = new DesktopCreatureRuntime({
      worldService: desktopWorldService,
      reducedMotion,
      onLocomotionChange(nextLocomotion) {
        setLocomotion(nextLocomotion);
        setVisualState(visualStateForLocomotion(nextLocomotion));
        if (nextLocomotion === 'sleep') {
          setState('sleeping');
        }
      },
      onAnimationIntentChange: setAnimationIntent,
    });
    creatureRuntimeRef.current = runtime;
    void runtime.start();
    void storageService
      .getSettings()
      .then((settings) => {
        runtime.setPreferences(
          movementPreferencesFromStorage(settings.companionPreferences, reducedMotion),
        );
      })
      .catch(() => undefined);
    const diagnosticsTimer = import.meta.env.DEV
      ? window.setInterval(() => {
          void companionService.emitInteraction({
            type: 'creature_diagnostics',
            diagnostics: runtime.getDiagnostics(renderCountRef.current),
          });
        }, 500)
      : null;
    return () => {
      creatureRuntimeRef.current = null;
      runtime.stop();
      if (diagnosticsTimer !== null) {
        window.clearInterval(diagnosticsTimer);
      }
    };
  }, [companionService, desktopWorldService, storageService]);

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
          creatureRuntimeRef.current?.setDoNotDisturb(true);
          setState('sleeping');
          setVisualState({ emotion: 'sleepy', activity: 'sleeping' });
        } else if (command.type === 'bring_buddy_back') {
          void creatureRuntimeRef.current?.bringBack(false);
        } else if (command.type === 'movement_preferences_changed') {
          creatureRuntimeRef.current?.setPreferences(command.preferences);
        } else if (command.type === 'creature_lab_action') {
          void creatureRuntimeRef.current?.applyLabAction(command.action);
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
      const moving = ['walk', 'fall', 'land', 'dragged', 'dropped', 'recover'].includes(locomotion);
      const priority =
        state === 'error'
          ? 'alert'
          : state === 'idle' && !moving
            ? 'ambient'
            : 'active_conversation';
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
  }, [locomotion, state, visualState, windowService]);

  useEffect(() => {
    creatureRuntimeRef.current?.setConversationActive(
      ['listening', 'thinking', 'talking', 'concerned', 'error'].includes(state),
    );
  }, [state]);

  const toggleBubble = () => {
    lastInteractionRef.current = Date.now();
    creatureRuntimeRef.current?.noteInteraction();
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
        {...(animationIntent ? { animationIntent } : {})}
        reducedMotion={animationIntent?.intensity === 0}
        companionService={companionService}
        onActivate={toggleBubble}
        onDragStart={() => {
          creatureRuntimeRef.current?.beginDrag();
        }}
        onDragEnd={() => {
          void creatureRuntimeRef.current?.endDrag();
        }}
        onHoverStart={() => {
          lastInteractionRef.current = Date.now();
          creatureRuntimeRef.current?.noteInteraction();
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

function movementPreferencesFromStorage(
  preferences: CompanionPreferences,
  systemReducedMotion: boolean,
): CreatureMovementPreferences {
  return {
    autonomousMovementEnabled: preferences.autonomousMovementEnabled,
    movementIntensity: preferences.movementIntensity,
    surfaceInteractionEnabled: preferences.surfaceInteractionEnabled,
    followMovingSurfaces: preferences.followMovingSurfaces,
    cursorAwarenessEnabled: preferences.cursorAwarenessEnabled,
    multiMonitorWanderingEnabled: preferences.multiMonitorWanderingEnabled,
    reducedMotion: preferences.reducedMovementEnabled || systemReducedMotion,
  };
}

function visualStateForLocomotion(locomotion: CreatureLocomotion): BuddyVisualState {
  switch (locomotion) {
    case 'walk':
      return { emotion: 'curious', activity: 'looking' };
    case 'sit':
      return { emotion: 'calm', activity: 'sitting' };
    case 'sleep':
      return { emotion: 'sleepy', activity: 'sleeping' };
    case 'fall':
    case 'dropped':
    case 'dragged':
      return { emotion: 'concerned', activity: 'alert' };
    case 'land':
    case 'recover':
      return { emotion: 'curious', activity: 'waking' };
    case 'writing':
      return { emotion: 'calm', activity: 'writing' };
    case 'listening':
      return { emotion: 'curious', activity: 'listening' };
    case 'talking':
      return { emotion: 'happy', activity: 'talking' };
    case 'thinking':
      return { emotion: 'calm', activity: 'thinking' };
    case 'idle':
    case 'climb':
    case 'hang':
    case 'peek':
      return { emotion: 'calm', activity: 'breathing' };
  }
}
