import { planCreatureAction, createSeededRandom } from '../domain/creature/planner';
import {
  animationIntentChanged,
  createAnimationIntent,
  type CreatureAnimationIntent,
  type CreatureAnimationReason,
} from '../domain/creature/animation';
import type { CreatureLabAction, CreatureRuntimeDiagnostics } from '../domain/creature/diagnostics';
import {
  DEFAULT_CREATURE_MOVEMENT_PREFERENCES,
  type CreatureMovementPreferences,
  type MovementIntensity,
} from '../domain/creature/preferences';
import { safeSpawn } from '../domain/creature/physics';
import { advanceCreatureClock, createCreatureSimulation } from '../domain/creature/simulation';
import {
  buildSafeAreas,
  buildSurfaceGraph,
  reconcileMovingWindowSurface,
} from '../domain/creature/surfaces';
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
  preferences?: Partial<CreatureMovementPreferences>;
  sleepAfterSeconds?: number;
  seed?: number;
  onLocomotionChange?: (locomotion: CreatureLocomotion) => void;
  onAnimationIntentChange?: (intent: CreatureAnimationIntent) => void;
}

export class DesktopCreatureRuntime {
  private readonly worldService: DesktopWorldService;
  private readonly config: CreatureSimulationConfig;
  private readonly random: () => number;
  private readonly onLocomotionChange: (locomotion: CreatureLocomotion) => void;
  private readonly onAnimationIntentChange: (intent: CreatureAnimationIntent) => void;
  private readonly plannerSeed: number;
  private preferences: CreatureMovementPreferences;
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
  private lastAnimationIntent: CreatureAnimationIntent | null = null;
  private pendingAnimationReason: CreatureAnimationReason = 'initial_state';
  private dragStartedAtMs: number | null = null;
  private dragStartPosition: { x: number; y: number } | null = null;
  private pointerState: CreatureRuntimeDiagnostics['pointerState'] = 'idle';
  private lastPlannerDecision = 'not_started';
  private tickCount = 0;
  private snapshotRequestCount = 0;
  private nativeMovementRequestCount = 0;
  private startedAtPerformanceMs = 0;

  constructor(options: CreatureRuntimeOptions) {
    this.worldService = options.worldService;
    this.config = options.config ?? DEFAULT_CREATURE_CONFIG;
    this.plannerSeed = options.seed ?? Date.now();
    this.random = createSeededRandom(this.plannerSeed);
    this.onLocomotionChange = options.onLocomotionChange ?? (() => undefined);
    this.onAnimationIntentChange = options.onAnimationIntentChange ?? (() => undefined);
    this.preferences = {
      ...DEFAULT_CREATURE_MOVEMENT_PREFERENCES,
      ...options.preferences,
      autonomousMovementEnabled:
        options.autonomyEnabled ??
        options.preferences?.autonomousMovementEnabled ??
        DEFAULT_CREATURE_MOVEMENT_PREFERENCES.autonomousMovementEnabled,
      reducedMotion:
        options.reducedMotion ??
        options.preferences?.reducedMotion ??
        DEFAULT_CREATURE_MOVEMENT_PREFERENCES.reducedMotion,
      movementIntensity:
        options.intensity ??
        options.preferences?.movementIntensity ??
        DEFAULT_CREATURE_MOVEMENT_PREFERENCES.movementIntensity,
    };
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
    this.startedAtPerformanceMs = this.lastTickAtMs;
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

  setPreferences(preferences: CreatureMovementPreferences): void {
    const previous = this.preferences;
    const needsReducedMotionRecovery =
      preferences.reducedMotion &&
      this.clock !== null &&
      this.world !== null &&
      ['fall', 'dropped'].includes(this.clock.simulation.physical.locomotion);
    this.preferences = { ...preferences };
    this.nextDecisionAtMs = Date.now();
    if (needsReducedMotionRecovery && this.clock) {
      this.pendingAnimationReason = 'reduced_motion';
      this.placeAtSafeRecovery(this.clock.simulation.physical.position);
    } else if (
      (!preferences.autonomousMovementEnabled && previous.autonomousMovementEnabled) ||
      (preferences.reducedMotion && !previous.reducedMotion)
    ) {
      this.stopAutonomousMotion();
    }
    if (!preferences.surfaceInteractionEnabled) {
      this.detachFromWindowSurface();
    }
  }

  beginDrag(): void {
    this.noteInteraction();
    if (!this.clock) {
      return;
    }
    this.dragStartedAtMs = Date.now();
    this.dragStartPosition = { ...this.clock.simulation.physical.position };
    this.pointerState = 'dragging';
    this.pendingAnimationReason = 'direct_interaction';
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
    if (this.preferences.reducedMotion) {
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
      this.dragStartedAtMs = null;
      this.dragStartPosition = null;
      this.pointerState = 'released';
      this.pendingAnimationReason = 'reduced_motion';
      this.emitLocomotion();
      return;
    }
    const elapsedSeconds = Math.max(
      0.05,
      (Date.now() - (this.dragStartedAtMs ?? Date.now())) / 1_000,
    );
    const releaseVelocity = this.dragStartPosition
      ? {
          x: (position.x - this.dragStartPosition.x) / elapsedSeconds,
          y: (position.y - this.dragStartPosition.y) / elapsedSeconds,
        }
      : { x: 0, y: 80 };
    this.dragStartedAtMs = null;
    this.dragStartPosition = null;
    this.pointerState = 'released';
    this.pendingAnimationReason = 'direct_interaction';
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
          releaseVelocity,
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
    this.pendingAnimationReason = 'safe_recovery';
    this.emitLocomotion();
  }

  getDiagnostics(reactRenderCount = 0): CreatureRuntimeDiagnostics {
    const elapsedSeconds = Math.max(
      0.001,
      (performance.now() - this.startedAtPerformanceMs) / 1_000,
    );
    return {
      worldSnapshot: this.world?.snapshot ?? null,
      surfaces: this.world?.surfaces ?? [],
      physical: this.clock?.simulation.physical ?? null,
      behavior: this.clock?.simulation.behavior ?? null,
      plannerSeed: this.plannerSeed,
      nextDecisionAtMs: this.nextDecisionAtMs,
      plannerDecision: this.lastPlannerDecision,
      animationIntent: this.lastAnimationIntent,
      pointerState: this.pointerState,
      movementIntensity: this.preferences.movementIntensity,
      reducedMotion: this.preferences.reducedMotion,
      autonomyEnabled: this.preferences.autonomousMovementEnabled,
      targetTickRateHz: Math.round(1_000 / this.config.fixedTimestepMs),
      observedTickRateHz: this.tickCount / elapsedSeconds,
      snapshotRequestCount: this.snapshotRequestCount,
      nativeMovementRequestCount: this.nativeMovementRequestCount,
      reactRenderCount,
    };
  }

  async applyLabAction(action: CreatureLabAction): Promise<void> {
    if (action === 'bring_back') {
      await this.bringBack();
      return;
    }
    if (action === 'reduced_motion') {
      this.setPreferences({ ...this.preferences, reducedMotion: !this.preferences.reducedMotion });
      return;
    }
    if (action === 'autonomy_off') {
      this.setPreferences({ ...this.preferences, autonomousMovementEnabled: false });
      return;
    }
    if (action.startsWith('planner_')) {
      this.setPreferences({
        ...this.preferences,
        autonomousMovementEnabled: true,
        movementIntensity: action.replace('planner_', '') as MovementIntensity,
      });
      return;
    }
    if (!this.clock || !this.world) {
      return;
    }
    const physical = this.clock.simulation.physical;
    this.pendingAnimationReason = 'direct_interaction';
    switch (action) {
      case 'walk_left':
      case 'walk_right': {
        const surface = this.world.surfaces.find(
          (candidate) => candidate.id === physical.currentSurfaceId,
        );
        if (surface) {
          this.clock.simulation.physical = {
            ...physical,
            locomotion: 'walk',
            destination: {
              x:
                action === 'walk_left'
                  ? surface.start.x + this.config.edgeMargin
                  : surface.end.x - this.config.buddySize.width - this.config.edgeMargin,
              y: physical.position.y,
            },
          };
        }
        break;
      }
      case 'fall':
        this.clock.simulation.physical = {
          ...physical,
          grounded: false,
          currentSurfaceId: null,
          locomotion: 'fall',
          destination: null,
        };
        break;
      case 'land':
        this.placeAtSafeRecovery(physical.position);
        this.clock.simulation.physical.locomotion = 'land';
        break;
      case 'sit':
      case 'sleep':
      case 'writing':
        this.clock.simulation.physical = {
          ...physical,
          velocity: { x: 0, y: 0 },
          locomotion: action,
          destination: null,
          stateElapsedMs: 0,
        };
        break;
      case 'drag_fixture':
        this.beginDrag();
        break;
      case 'drop_fixture':
        this.clock.simulation.physical = {
          ...physical,
          grounded: false,
          currentSurfaceId: null,
          locomotion: 'dropped',
          dragState: {
            kind: 'dropped',
            releasedAtMs: Date.now(),
            releaseVelocity: { x: 120, y: 80 },
          },
        };
        this.pointerState = 'released';
        break;
      case 'remove_surface':
        this.world.surfaces = this.world.surfaces.filter(
          (surface) => surface.id !== physical.currentSurfaceId,
        );
        break;
      case 'move_surface': {
        const surface = this.world.surfaces.find(
          (candidate) => candidate.id === physical.currentSurfaceId,
        );
        if (surface?.kind === 'window_top') {
          surface.start = { x: surface.start.x + 12, y: surface.start.y + 6 };
          surface.end = { x: surface.end.x + 12, y: surface.end.y + 6 };
        }
        break;
      }
      case 'monitor_removal':
        this.world.safeAreas = this.world.safeAreas.filter(
          (area) => !pointInBounds(physical.position, area.bounds),
        );
        break;
      case 'negative_monitor':
        this.world.safeAreas = [
          {
            monitorId: 'fixture-negative',
            bounds: { x: -1_280, y: 0, width: 1_280, height: 984 },
            primary: true,
          },
        ];
        this.placeAtSafeRecovery({ x: -900, y: 200 });
        break;
      case 'mixed_dpi':
        this.world.snapshot = {
          ...this.world.snapshot,
          monitors: this.world.snapshot.monitors.map((monitor, index) => ({
            ...monitor,
            scaleFactor: index === 0 ? 1 : 1.5,
          })),
        };
        break;
      case 'offscreen_spawn':
        this.clock.simulation.physical = {
          ...physical,
          position: { x: Number.MAX_SAFE_INTEGER, y: Number.MAX_SAFE_INTEGER },
        };
        break;
      case 'planner_low':
      case 'planner_medium':
      case 'planner_lively':
        break;
    }
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
    this.tickCount += 1;
    const elapsedMs = Math.min(250, Math.max(0, now - this.lastTickAtMs));
    this.lastTickAtMs = now;
    this.planIfDue(Date.now());
    const previous = this.clock.simulation.physical.position;
    this.clock = advanceCreatureClock(this.clock, elapsedMs, this.world, this.config);
    const current = this.clock.simulation.physical.position;
    this.emitLocomotion();
    if (Math.abs(previous.x - current.x) >= 0.5 || Math.abs(previous.y - current.y) >= 0.5) {
      this.requestNativeMove(current);
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
    const currentArea = this.world.safeAreas.find((area) =>
      pointInBounds(this.clock?.simulation.physical.position, area.bounds),
    );
    const plannerSurfaces = this.preferences.multiMonitorWanderingEnabled
      ? this.world.surfaces
      : this.world.surfaces.filter(
          (surface) =>
            surface.id === this.clock?.simulation.physical.currentSurfaceId ||
            surface.monitorId === currentArea?.monitorId,
        );
    const userIdleSeconds = Math.floor((nowMs - this.lastInteractionAtMs) / 1_000);
    const plan = planCreatureAction(this.clock.simulation, {
      nowMs,
      autonomyEnabled: this.preferences.autonomousMovementEnabled,
      reducedMotion: this.preferences.reducedMotion,
      doNotDisturb: this.doNotDisturb,
      conversationActive: this.conversationActive,
      journalActive: this.journalActive,
      userIdleSeconds,
      sleepAfterSeconds: this.sleepAfterSeconds,
      intensity: this.preferences.movementIntensity,
      surfaces: plannerSurfaces,
      random: this.random,
    });
    this.lastPlannerDecision = plan.reason;
    this.pendingAnimationReason = 'autonomous_plan';
    const sleepDeadlineMs = nowMs + Math.max(0, this.sleepAfterSeconds - userIdleSeconds) * 1_000;
    this.nextDecisionAtMs = ['wander', 'sit', 'write', 'rest'].includes(plan.reason)
      ? Math.min(plan.nextDecisionAtMs, sleepDeadlineMs)
      : plan.nextDecisionAtMs;
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
    if (!this.clock) {
      return;
    }
    const physical = this.clock.simulation.physical;
    if (
      physical.dragState.kind !== 'none' ||
      ['fall', 'land', 'recover', 'dropped'].includes(physical.locomotion)
    ) {
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
    this.pendingAnimationReason = this.conversationActive
      ? 'conversation_state'
      : 'autonomous_plan';
    this.emitLocomotion();
  }

  private async refreshWorld(): Promise<void> {
    try {
      const snapshot = await this.worldService.snapshot({
        includeCursor: this.preferences.cursorAwarenessEnabled,
      });
      this.snapshotRequestCount += 1;
      const previousWorld = this.world;
      const nextWorld: CreatureWorld = {
        snapshot,
        safeAreas: buildSafeAreas(snapshot),
        surfaces: buildSurfaceGraph(snapshot, Date.now(), {
          includeWindowSurfaces: this.preferences.surfaceInteractionEnabled,
        }),
      };
      this.reconcileWorld(previousWorld, nextWorld);
      this.world = nextWorld;
    } catch {
      // Browser previews and transient native failures keep the static buddy usable.
    }
  }

  private reconcileWorld(previousWorld: CreatureWorld | null, nextWorld: CreatureWorld): void {
    if (!this.clock || !previousWorld) {
      return;
    }
    const physical = this.clock.simulation.physical;
    if (!physical.grounded || !physical.currentSurfaceId) {
      return;
    }
    const previousSurface = previousWorld.surfaces.find(
      (surface) => surface.id === physical.currentSurfaceId,
    );
    if (previousSurface?.kind !== 'window_top') {
      return;
    }
    if (!this.preferences.surfaceInteractionEnabled || !this.preferences.followMovingSurfaces) {
      this.detachFromWindowSurface();
      return;
    }
    const follow = reconcileMovingWindowSurface({
      previousSurface,
      nextSurfaces: nextWorld.surfaces,
      position: physical.position,
      buddyWidth: this.config.buddySize.width,
      buddyHeight: this.config.buddySize.height,
      edgeMargin: this.config.edgeMargin,
    });
    if (follow.kind === 'detached') {
      this.detachFromWindowSurface();
      return;
    }
    this.clock.simulation.physical = {
      ...physical,
      position: follow.position,
      currentSurfaceId: follow.surfaceId,
    };
    if (follow.kind === 'followed') {
      this.requestNativeMove(follow.position);
    }
  }

  private detachFromWindowSurface(): void {
    const physical = this.clock?.simulation.physical;
    if (!this.clock || !physical?.currentSurfaceId?.startsWith('window_top:')) {
      return;
    }
    this.clock.simulation.physical = {
      ...physical,
      grounded: false,
      currentSurfaceId: null,
      destination: null,
      locomotion: 'fall',
      stateElapsedMs: 0,
    };
    this.pendingAnimationReason = 'physics_transition';
    this.emitLocomotion();
  }

  private placeAtSafeRecovery(preferred: { x: number; y: number }): void {
    if (!this.clock || !this.world) {
      return;
    }
    const spawn = safeSpawn(this.world.safeAreas, this.config, preferred);
    this.clock.simulation.physical = {
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
    };
    this.requestNativeMove(spawn.position);
    this.emitLocomotion();
  }

  private requestNativeMove(position: { x: number; y: number }): void {
    if (this.movementInFlight) {
      return;
    }
    this.movementInFlight = true;
    this.nativeMovementRequestCount += 1;
    void this.worldService
      .moveBuddyTo(position)
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
    if (this.clock) {
      const previousIntent = this.lastAnimationIntent;
      const enteredAt =
        previousIntent && previousIntent.locomotion === locomotion
          ? previousIntent.enteredAt
          : Date.now();
      const intent = createAnimationIntent(this.clock.simulation, {
        nowMs: Date.now(),
        enteredAt,
        reasonCode: this.pendingAnimationReason,
        reducedMotion: this.preferences.reducedMotion,
      });
      if (animationIntentChanged(this.lastAnimationIntent, intent)) {
        this.lastAnimationIntent = intent;
        this.onAnimationIntentChange(intent);
      }
      this.pendingAnimationReason = 'physics_transition';
    }
  }
}

function pointInBounds(
  point: { x: number; y: number } | undefined,
  bounds: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    point !== undefined &&
    point.x >= bounds.x &&
    point.x < bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y < bounds.y + bounds.height
  );
}
