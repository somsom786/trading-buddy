import { useState } from 'react';
import type { LocalModel } from '../../domain/local-ai/types';

interface ModelSelectorProps {
  models: LocalModel[];
  selectedModel: string | null;
  thinking: boolean;
  disabled: boolean;
  onSelect: (model: string | null) => void;
  onThinkingChange: (enabled: boolean) => void;
}

export function ModelSelector({
  models,
  selectedModel,
  thinking,
  disabled,
  onSelect,
  onThinkingChange,
}: ModelSelectorProps) {
  const names = new Set(models.map((model) => model.name));
  const [draft, setDraft] = useState(selectedModel ?? '');

  return (
    <div className="model-controls">
      <label>
        <span>Local model</span>
        <input
          list="local-models"
          value={draft}
          disabled={disabled}
          placeholder="Choose an installed model"
          onChange={(event) => {
            const value = event.target.value;
            setDraft(value);
            onSelect(names.has(value) ? value : null);
          }}
        />
        <datalist id="local-models">
          {models.map((model) => (
            <option key={model.name} value={model.name}>
              {[model.parameterSize, model.quantizationLevel].filter(Boolean).join(' · ')}
            </option>
          ))}
        </datalist>
      </label>
      {import.meta.env.DEV ? (
        <label className="thinking-toggle">
          <input
            type="checkbox"
            checked={thinking}
            disabled={disabled}
            onChange={(event) => {
              onThinkingChange(event.target.checked);
            }}
          />
          Thinking {thinking ? 'on' : 'off'}
        </label>
      ) : null}
    </div>
  );
}
