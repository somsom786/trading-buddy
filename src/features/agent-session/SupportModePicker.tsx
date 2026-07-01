import { COMPANION_SUPPORT_MODES, supportModeLabel } from '../../domain/agent-session/supportMode';
import type { CompanionSupportMode } from '../../domain/agent-session/types';

interface SupportModePickerProps {
  value: CompanionSupportMode;
  disabled?: boolean;
  compact?: boolean;
  onChange: (mode: CompanionSupportMode) => void;
}

export function SupportModePicker({
  value,
  disabled = false,
  compact = false,
  onChange,
}: SupportModePickerProps) {
  return (
    <div
      className={
        compact ? 'support-mode-picker support-mode-picker--compact' : 'support-mode-picker'
      }
    >
      {COMPANION_SUPPORT_MODES.map((mode) => (
        <button
          type="button"
          key={mode}
          aria-pressed={value === mode}
          disabled={disabled}
          onClick={() => {
            onChange(mode);
          }}
        >
          {supportModeLabel(mode)}
        </button>
      ))}
    </div>
  );
}
