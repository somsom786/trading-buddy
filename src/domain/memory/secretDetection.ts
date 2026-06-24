const secretSignals = [
  /\b(seed phrase|recovery phrase|mnemonic)\b/i,
  /\b(private key|secret key|api key|auth token|authentication token|bearer token)\b/i,
  /\bpassword\s*[:=]/i,
  /\brecovery code\s*[:=]/i,
  /\bsk-[A-Za-z0-9_-]{12,}\b/,
  /\b0x[a-fA-F0-9]{64}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:[a-z]+ ){11,23}[a-z]+\b/i,
];

export function looksLikeSecret(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed) {
    return false;
  }
  return secretSignals.some((pattern) => pattern.test(trimmed));
}

export function safeSecretRefusal(): string {
  return 'I can’t save secrets like passwords, seed phrases, private keys, API keys, or recovery codes in companion memory.';
}
