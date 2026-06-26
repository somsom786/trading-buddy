import {
  planCreatureAction,
  createSeededRandom,
  type MovementIntensity,
} from '../domain/creature/planner';
import { safeSpawn } from '../domain/creature/physics';
import { advanceCreatureClock, createCreatureSimulation } from '../domain/creature/simulation';
import { buildSafeAreas, buildSurfaceGraph } from '../domain/creature/surfaces';
import {
  DEFAULT_CREATURE_CONFIG,
  type CreatureClockState,
  type CreatureLocomotion,
  type CreatureSimulationConfig,
  type CreatureWorld,
} from '../domain/creature/types';
import type { DesktopWorldService } from './tauri/desktopWorldService';

interface CreatureRuntimeOptions {
  worldService: DesktopWorldService;
  config?: CreatureSimulationConfig;
  autonomyEnabled?: boolean;
  reducedMotion?: boolean;
  intensity?: MovementIntensity;
  sleepAfterSeconds?: number;
  seed?: number;
  onLocomotionChange?: (locomotion: CreatureLocomotion) => void;
}

export class DesktopCreatureRuntime {
  private readonly worldService: DesktopWorldService;
  private readonly config: CreatureSimulationConfig;
  private readonly random: () => number;
  private readonly onLocomotionChange: (locomotion: CreatureLocomotion) => void;
  private readonly autonomyEnabled: boolean;
  private readonly reducedMotion: boolean;
  private readonly intensity: MovementIntensity;
  private readonly sleepAfterSeconds: number;
  private world: CreatureWorld | null = null;
  private clock: CreatureClockState | null = null;
  private tickTimer: number | null = null;
  private snapshotTimer: number | null = null;
  private lastTickAtMs = 0;
  private nextDecisionAtMs = 0;
  private lastInteractionAtMs = Date.now();
  private conversationActive = false;
  private journalActive = false;
  private doNotDisturb = false;
  private movementInFlight = false;
  private stopped = true;
  private lastLocomotion: CreatureLocomotion | null = null;

  constructor(options: CreatureRuntimeOptions) {
    this.worldService = options.worldService;
    this.config = options.config ?? DEFAULT_CREATURE_CONFIG;
    this.random = createSeededRandom(options.seed ?? Date.now());
    this.onLocomotionChange = options.onLocomotionChange ?? (() => undefined);
    this.autonomyEnabled = options.autonomyEnabled ?? true;
    this.reducedMotion = options.reducedMotion ?? false;
    this.intensity = options.intensity ?? 'medium';
    this.sleepAfterSeconds = options.sleepAfterSeconds ?? 900;
  }

  async start(): Promise<void> {
    if (!this.stopped) {
      return;
    }
    this.stopped = false;
    await this.refreshWorld();
    if (!this.world) {
      return;
    }
    this.clock = {
      simulation: createCreatureSimulation(this.world, this.config, Date.now()),
      accumulatorMs: 0,
    };
    this.lastTickAtMs = performance.now();
    this.nextDecisionAtMs = Date.now() + 2_500;
    this.emitLocomotion();
    this.scheduleTick();
    this.scheduleSnapshot();
  }

  stop(): void {
    this.stopped = true;
    if (this.tickTimer !== null) {
      window.clearTimeout(this.tickTimer);
      this.tickTimer = null;
    }
    if (this.snapshotTimer !== null) {
      window.clearTimeout(this.snapshotTimer);
      this.snapshotTimer = null;
    }
  }

  noteInteraction(): void {
    this.lastInteractionAtMs = Date.now();
    if (this.clock?.simulation.physical.locomotion === 'sleep') {
      this.clock.simulation = {
        ...this.clock.simulation,
        behavior: 'resting',
        physical: {
          ...this.clock.simulation.physical,
          locomotion: 'idle',
          stateElapsedMs: 0,
        },
      };
      this.nextDecisionAtMs = Date.now() + 1_000;
      this.emitLocomotion();
    }
  }

  setConversationActive(active: boolean): void {
    this.conversationActive = active;
    if (active) {
      this.stopAutonomousMotion();
    }
  }

  setJournalActive(active: boolean): void {
    this.journalActive = active;
    if (active) {
      this.stopAutonomousMotion();
    }
  }

  setDoNotDisturb(active: boolean): void {
    this.doNotDisturb = active;
    if (active) {
      this.stopAutonomousMotion();
    }
  }

  beginDrag(): void {
    this.noteInteraction();
    if (!this.clock) {
      return;
    }
    this.clock.simulation = {
      ...this.clock.simulation,
      behavior: 'interacting',
      physical: {
        ...this.clock.simulation.physical,
        velocity: { x: 0, y: 0 },
        acceleration: { x: 0, y: 0 },
        grounded: false,
        currentSurfaceId: null,
        destination: null,
        locomotion: 'dragged',
        dragState: { kind: 'dragging', startedAtMs: Date.now() },
        stateElapsedMs: 0,
      },
    };
    this.emitLocomotion();
  }

  async endDrag(): Promise<void> {
    this.noteInteraction();
    await this.refreshWorld();
    if (!this.clock || !this.world) {
      return;
    }
    const position = {
      x: this.world.snapshot.buddyRect.x,
      y: this.world.snapshot.buddyRect.y,
    };
    if (this.reducedMotion) {
      const spawn = safeSpawn(this.world.safeAreas, this.config, position);
      this.clock.simulation = {
        ...this.clock.simulation,
        behavior: 'recovering',
        physical: {
          ...this.clock.simulation.physical,
          position: spawn.position,
          velocity: { x: 0, y: 0 },
          acceleration: { x: 0, y: 0 },
          grounded: spawn.surfaceId !== null,
          currentSurfaceId: spawn.surfaceId,
          destination: null,
          locomotion: 'recover',
          dragState: { kind: 'none' },
          stateElapsedMs: 0,
        },
      };
      await this.worldService.moveBuddyTo(spawn.position);
      this.emitLocomotion();
      return;
    }
    this.clock.simulation = {
      ...this.clock.simulation,
      behavior: 'recovering',
      physical: {
        ...this.clock.simulation.physical,
        position,
        velocity: { x: 0, y: 0 },
        acceleration: { x: 0, y: this.config.gravity },
        grounded: false,
        currentSurfaceId: null,
        destination: null,
        locomotion: 'dropped',
        dragState: {
          kind: 'dropped',
          releasedAtMs: Date.now(),
          releaseVelocity: { x: 0, y: 80 },
        },
        stateElapsedMs: 0,
      },
    };
    this.emitLocomotion();
  }

  async bringBack(moveNative = true): Promise<void> {
    if (moveNative) {
      await this.worldService.bringBuddyBack();
    }
    await this.refreshWorld();
    if (!this.world) {
      return;
    }
    this.clock = {
      simulation: createCreatureSimulation(this.world, this.config, Date.now()),
      accumulatorMs: 0,
    };
    this.nextDecisionAtMs = Date.now() + 2_500;
    this.emitLocomotion();
  }

  private scheduleTick(): void {
    if (this.stopped) {
      return;
    }
    this.tickTimer = window.setTimeout(() => {
      this.tick();
      this.scheduleTick();
    }, this.config.fixedTimestepMs);
  }

  private tick(): void {
    if (!this.clock || !this.world || this.stopped) {
      return;
    }
    const now = performance.now();
    const elapsedMs = Math.min(250, Math.max(0, now - this.lastTickAtMs));
    this.lastTickAtMs = now;
    this.planIfDue(Date.now());
    const previous = this.clock.simulation.physical.position;
    this.clock = advanceCreatureClock(this.clock, elapsedMs, this.world, this.config);
    const current = this.clock.simulation.physical.position;
    this.emitLocomotion();
    if (
      !this.movementInFlight &&
      (Math.abs(previous.x - current.x) >= 0.5 || Math.abs(previous.y - current.y) >= 0.5)
    ) {
      this.movementInFlight = true;
      void this.worldService
        .moveBuddyTo(current)
        .then((clamped) => {
          if (this.clock) {
            this.clock.simulation.physical.position = clamped;
          }
        })
        .catch(() => undefined)
        .finally(() => {
          this.movementInFlight = false;
        });
    }
  }

  private planIfDue(nowMs: number): void {
    if (!this.clock || !this.world || nowMs < this.nextDecisionAtMs) {
      return;
    }
    const locomotion = this.clock.simulation.physical.locomotion;
    if (['fall', 'land', 'recover', 'dragged', 'dropped'].includes(locomotion)) {
      this.nextDecisionAtMs = nowMs + 1_000;
      return;
    }
    const plan = planCreatureAction(this.clock.simulation, {
      nowMs,
      autonomyEnabled: this.autonomyEnabled,
      reducedMotion: this.reducedMotion,
      doNotDisturb: this.doNotDisturb,
      conversationActive: this.conversationActive,
      journalActive: this.journalActive,
      userIdleSeconds: Math.floor((nowMs - this.lastInteractionAtMs) / 1_000),
      sleepAfterSeconds: this.sleepAfterSeconds,
      intensity: this.intensity,
      surfaces: this.world.surfaces,
      random: this.random,
    });
    this.nextDecisionAtMs = plan.nextDecisionAtMs;
    this.clock.simulation = {
      ...this.clock.simulation,
      behavior: plan.behavior,
      physical: {
        ...this.clock.simulation.physical,
        velocity:
          plan.locomotion === 'walk' ? this.clock.simulation.physical.velocity : { x: 0, y: 0 },
        locomotion: plan.locomotion,
        destination:
          plan.destinationX === null
            ? null
            : {
                x: plan.destinationX,
                y: this.clock.simulation.physical.position.y,
              },
        stateElapsedMs: 0,
      },
    };
  }

  private stopAutonomousMotion(): void {
    if (this.clock?.simulation.physical.dragState.kind !== 'none') {
      return;
    }
    this.clock.simulation = {
      ...this.clock.simulation,
      behavior: 'conversing',
      physical: {
        ...this.clock.simulation.physical,
        velocity: { x: 0, y: 0 },
        acceleration: { x: 0, y: 0 },
        destination: null,
        locomotion: 'idle',
        stateElapsedMs: 0,
      },
    };
    this.emitLocomotion();
  }

  private async refreshWorld(): Promise<void> {
    try {
      const snapshot = await this.worldService.snapshot();
      this.world = {
        snapshot,
        safeAreas: buildSafeAreas(snapshot),
        surfaces: buildSurfaceGraph(snapshot, Date.now()),
      };
    } catch {
      // Browser previews and transient native failures keep the static buddy usable.
    }
  }

  private scheduleSnapshot(): void {
    if (this.stopped) {
      return;
    }
    const locomotion = this.clock?.simulation.physical.locomotion ?? 'idle';
    const delay =
      locomotion === 'sleep'
        ? 15_000
        : ['walk', 'fall', 'dragged', 'dropped'].includes(locomotion)
          ? 1_000
          : 4_000;
    this.snapshotTimer = window.setTimeout(() => {
      void this.refreshWorld().finally(() => {
        this.scheduleSnapshot();
      });
    }, delay);
  }

  private emitLocomotion(): void {
    const locomotion = this.clock?.simulation.physical.locomotion;
    if (locomotion && locomotion !== this.lastLocomotion) {
      this.lastLocomotion = locomotion;
      this.onLocomotionChange(locomotion);
    }
  }
}
