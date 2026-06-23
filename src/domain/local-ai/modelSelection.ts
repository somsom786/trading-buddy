import { LOCAL_AI_CONFIG } from './config';
import type { LocalModel } from './types';

export function selectPreferredModel(
  models: LocalModel[],
  currentSelection: string | null,
): string | null {
  if (currentSelection && models.some((model) => model.name === currentSelection)) {
    return currentSelection;
  }
  return (
    models.find((model) => model.name === LOCAL_AI_CONFIG.recommendedModel)?.name ??
    models[0]?.name ??
    null
  );
}
