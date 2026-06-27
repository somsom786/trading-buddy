import { useEffect, useState } from 'react';
import {
  CREATURE_LAB_ACTIONS,
  type CreatureLabAction,
  type CreatureRuntimeDiagnostics,
} from '../../domain/creature/diagnostics';
import type { CompanionService } from '../../services/tauri/companionService';

interface CreatureLabProps {
  companionService: CompanionService;
}

export function CreatureLab({ companionService }: CreatureLabProps) {
  const [diagnostics, setDiagnostics] = useState<CreatureRuntimeDiagnostics | null>(null);

  useEffect(() => {
    let disposed = false;
    let cleanup: () => void = () => undefined;
    void companionService
      .subscribeInteractions((interaction) => {
        if (interaction.type === 'creature_diagnostics') {
          setDiagnostics(interaction.diagnostics);
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

  const run = (action: CreatureLabAction) => {
    void companionService.send({ type: 'creature_lab_action', action });
  };

  return (
    <details className="buddy-lab creature-lab">
      <summary>Creature Lab · development only</summary>
      <div className="buddy-lab__content">
        <p className="muted">
          Geometry-only diagnostics from the real buddy runtime. No titles, processes, pixels,
          application identity, clipboard, or keyboard data are available here.
        </p>

        <div className="creature-lab__controls" aria-label="Creature fixture controls">
          {CREATURE_LAB_ACTIONS.map((action) => (
            <button
              key={action}
              type="button"
              onClick={() => {
                run(action);
              }}
            >
              {action.replaceAll('_', ' ')}
            </button>
          ))}
        </div>

        {diagnostics ? (
          <>
            <dl>
              <dt>Physical position</dt>
              <dd>{pointLabel(diagnostics.physical?.position)}</dd>
              <dt>Velocity</dt>
              <dd>{pointLabel(diagnostics.physical?.velocity)}</dd>
              <dt>Acceleration</dt>
              <dd>{pointLabel(diagnostics.physical?.acceleration)}</dd>
              <dt>Grounded</dt>
              <dd>{String(diagnostics.physical?.grounded ?? false)}</dd>
              <dt>Current surface</dt>
              <dd>{diagnostics.physical?.currentSurfaceId ?? 'none'}</dd>
              <dt>Destination</dt>
              <dd>{pointLabel(diagnostics.physical?.destination ?? undefined)}</dd>
              <dt>Behavior</dt>
              <dd>{diagnostics.behavior ?? 'not started'}</dd>
              <dt>Planner seed</dt>
              <dd>{diagnostics.plannerSeed}</dd>
              <dt>Planner decision</dt>
              <dd>{diagnostics.plannerDecision}</dd>
              <dt>Next decision</dt>
              <dd>{new Date(diagnostics.nextDecisionAtMs).toISOString()}</dd>
              <dt>Animation intent</dt>
              <dd>
                {diagnostics.animationIntent
                  ? `${diagnostics.animationIntent.locomotion} · ${diagnostics.animationIntent.reasonCode}`
                  : 'none'}
              </dd>
              <dt>Pointer state</dt>
              <dd>{diagnostics.pointerState}</dd>
              <dt>Target / observed tick rate</dt>
              <dd>
                {diagnostics.targetTickRateHz} / {diagnostics.observedTickRateHz.toFixed(1)} Hz
              </dd>
              <dt>Snapshot requests</dt>
              <dd>{diagnostics.snapshotRequestCount}</dd>
              <dt>Native movement requests</dt>
              <dd>{diagnostics.nativeMovementRequestCount}</dd>
              <dt>React renders</dt>
              <dd>{diagnostics.reactRenderCount}</dd>
              <dt>Movement mode</dt>
              <dd>
                {diagnostics.autonomyEnabled ? diagnostics.movementIntensity : 'autonomy off'}
                {diagnostics.reducedMotion ? ' · reduced' : ''}
              </dd>
            </dl>

            <details>
              <summary>Geometry-only world snapshot</summary>
              <pre>{JSON.stringify(diagnostics.worldSnapshot, null, 2)}</pre>
            </details>
            <details>
              <summary>Surface graph ({String(diagnostics.surfaces.length)})</summary>
              <pre>{JSON.stringify(diagnostics.surfaces, null, 2)}</pre>
            </details>
            <details>
              <summary>Physical and animation state</summary>
              <pre>
                {JSON.stringify(
                  {
                    physical: diagnostics.physical,
                    behavior: diagnostics.behavior,
                    animationIntent: diagnostics.animationIntent,
                  },
                  null,
                  2,
                )}
              </pre>
            </details>
          </>
        ) : (
          <p className="muted">Waiting for the desktop buddy runtime…</p>
        )}
      </div>
    </details>
  );
}

function pointLabel(point: { x: number; y: number } | undefined): string {
  return point ? `${point.x.toFixed(1)}, ${point.y.toFixed(1)}` : 'none';
}
