import { useEffect, useState } from 'react';
import type { CreatureMovementPreferences } from '../../domain/creature/preferences';
import type { CompanionPreferences, StorageError } from '../../domain/storage/types';
import { normalizeStorageError } from '../../domain/storage/types';
import type { CompanionService } from '../../services/tauri/companionService';
import type { StorageService } from '../../services/tauri/storageService';

interface CreatureMovementSettingsProps {
  storageService: StorageService;
  companionService: CompanionService;
  onNotice: (notice: string) => void;
  onError: (error: StorageError) => void;
}

export function CreatureMovementSettings({
  storageService,
  companionService,
  onNotice,
  onError,
}: CreatureMovementSettingsProps) {
  const [preferences, setPreferences] = useState<CompanionPreferences | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let disposed = false;
    void storageService
      .getSettings()
      .then((settings) => {
        if (!disposed) {
          setPreferences(settings.companionPreferences);
        }
      })
      .catch((error: unknown) => {
        if (!disposed) {
          onError(normalizeStorageError(error));
        }
      });
    return () => {
      disposed = true;
    };
  }, [onError, storageService]);

  const persist = async (next: CompanionPreferences) => {
    setPreferences(next);
    setSaving(true);
    try {
      const settings = await storageService.setCompanionPreferences(next);
      const saved = settings.companionPreferences;
      setPreferences(saved);
      await companionService.send({
        type: 'movement_preferences_changed',
        preferences: movementPreferences(saved),
      });
      onNotice('Creature movement settings saved and applied.');
    } catch (error) {
      onError(normalizeStorageError(error));
    } finally {
      setSaving(false);
    }
  };

  if (!preferences) {
    return (
      <section className="creature-settings" aria-label="Creature movement settings">
        <h2>Desktop movement</h2>
        <p className="muted">Loading local movement settings…</p>
      </section>
    );
  }

  const setBoolean = (key: BooleanPreferenceKey, value: boolean) => {
    void persist({ ...preferences, [key]: value });
  };

  return (
    <section className="creature-settings" aria-labelledby="creature-settings-title">
      <header>
        <p className="eyebrow">Desktop creature</p>
        <h2 id="creature-settings-title">Movement</h2>
        <p>These settings are stored locally and apply to the buddy without restarting.</p>
      </header>

      <div className="creature-settings__grid">
        <Toggle
          label="Autonomous movement"
          checked={preferences.autonomousMovementEnabled}
          disabled={saving}
          onChange={(value) => {
            setBoolean('autonomousMovementEnabled', value);
          }}
        />
        <label>
          Activity
          <select
            value={preferences.movementIntensity}
            disabled={saving || !preferences.autonomousMovementEnabled}
            onChange={(event) => {
              void persist({
                ...preferences,
                movementIntensity: event.currentTarget
                  .value as CompanionPreferences['movementIntensity'],
              });
            }}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="lively">Lively</option>
          </select>
        </label>
        <Toggle
          label="Use window-top surfaces"
          checked={preferences.surfaceInteractionEnabled}
          disabled={saving}
          onChange={(value) => {
            setBoolean('surfaceInteractionEnabled', value);
          }}
        />
        <Toggle
          label="Follow gently moving surfaces"
          checked={preferences.followMovingSurfaces}
          disabled={saving || !preferences.surfaceInteractionEnabled}
          onChange={(value) => {
            setBoolean('followMovingSurfaces', value);
          }}
        />
        <Toggle
          label="Allow movement across monitors"
          checked={preferences.multiMonitorWanderingEnabled}
          disabled={saving}
          onChange={(value) => {
            setBoolean('multiMonitorWanderingEnabled', value);
          }}
        />
        <Toggle
          label="Reduced movement"
          checked={preferences.reducedMovementEnabled}
          disabled={saving}
          onChange={(value) => {
            setBoolean('reducedMovementEnabled', value);
          }}
        />
        <Toggle
          label="Cursor-aware geometry"
          checked={preferences.cursorAwarenessEnabled}
          disabled={saving}
          onChange={(value) => {
            setBoolean('cursorAwarenessEnabled', value);
          }}
        />
      </div>
      <p className="muted">
        Cursor awareness only requests the pointer coordinate. It does not capture clicks,
        keystrokes, titles, applications, or screen content, and the buddy does not chase it.
      </p>
    </section>
  );
}

type BooleanPreferenceKey =
  | 'autonomousMovementEnabled'
  | 'surfaceInteractionEnabled'
  | 'followMovingSurfaces'
  | 'multiMonitorWanderingEnabled'
  | 'reducedMovementEnabled'
  | 'cursorAwarenessEnabled';

function Toggle(props: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="creature-settings__toggle">
      <input
        type="checkbox"
        checked={props.checked}
        disabled={props.disabled}
        onChange={(event) => {
          props.onChange(event.currentTarget.checked);
        }}
      />
      {props.label}
    </label>
  );
}

function movementPreferences(preferences: CompanionPreferences): CreatureMovementPreferences {
  return {
    autonomousMovementEnabled: preferences.autonomousMovementEnabled,
    movementIntensity: preferences.movementIntensity,
    surfaceInteractionEnabled: preferences.surfaceInteractionEnabled,
    followMovingSurfaces: preferences.followMovingSurfaces,
    cursorAwarenessEnabled: preferences.cursorAwarenessEnabled,
    multiMonitorWanderingEnabled: preferences.multiMonitorWanderingEnabled,
    reducedMotion: preferences.reducedMovementEnabled,
  };
}
