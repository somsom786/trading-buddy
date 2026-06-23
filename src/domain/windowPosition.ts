export interface WindowPosition {
  x: number;
  y: number;
}

export function isWindowPosition(value: unknown): value is WindowPosition {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return Number.isInteger(candidate.x) && Number.isInteger(candidate.y);
}
