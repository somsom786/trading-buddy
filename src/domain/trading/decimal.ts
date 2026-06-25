export function sumDecimalStrings(values: (string | undefined)[]): string | undefined {
  const parsed = values
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map(parseDecimal);
  if (parsed.length === 0) {
    return undefined;
  }
  const scale = Math.max(...parsed.map((value) => value.scale));
  const total = parsed.reduce(
    (sum, value) => sum + value.units * 10n ** BigInt(scale - value.scale),
    0n,
  );
  return formatScaledInteger(total, scale);
}

function parseDecimal(value: string): { units: bigint; scale: number } {
  const trimmed = value.trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
    throw new Error('Invalid decimal string.');
  }
  const negative = trimmed.startsWith('-');
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  const parts = unsigned.split('.');
  const whole = parts[0] ?? '0';
  const fraction = parts[1] ?? '';
  const digits = `${whole}${fraction}`;
  const units = BigInt(digits.length > 0 ? digits : '0') * (negative ? -1n : 1n);
  return { units, scale: fraction.length };
}

function formatScaledInteger(units: bigint, scale: number): string {
  const negative = units < 0n;
  const absolute = negative ? -units : units;
  if (scale === 0) {
    return `${negative ? '-' : ''}${absolute.toString()}`;
  }
  const padded = absolute.toString().padStart(scale + 1, '0');
  const whole = padded.slice(0, -scale);
  const fraction = padded.slice(-scale).replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`;
}
