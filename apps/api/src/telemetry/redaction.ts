/**
 * Redaction utility for sanitizing sensitive credentials, tokens, and secrets from telemetry payloads
 */

const SENSITIVE_PATTERNS = [
  // Bearer tokens and JWTs
  /(bearer\s+)[a-zA-Z0-9\-_.]+/gi,
  // Passwords, secrets, api keys
  /(password|passwd|secret|api[_-]?key|token|auth[_-]?token)\s*[:=]\s*["']?([^"',\s]+)["']?/gi,
  // Private keys (PEM)
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/gi,
  // Credit cards
  /\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/g,
  // Database connection strings with passwords
  /(postgres|mysql|redis|mongodb):\/\/[^:]+:([^@]+)@/gi,
];

export function redactSensitiveData(input: string): string {
  if (!input || typeof input !== 'string') return input;

  let sanitized = input;

  // Replace PEM keys
  sanitized = sanitized.replace(
    /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/gi,
    '[REDACTED_PRIVATE_KEY]'
  );

  // Replace Bearer tokens
  sanitized = sanitized.replace(/(bearer\s+)[a-zA-Z0-9\-_.]+/gi, '$1[REDACTED_TOKEN]');

  // Replace key-value secrets
  sanitized = sanitized.replace(
    /(password|passwd|secret|api[_-]?key|token|auth[_-]?token)\s*[:=]\s*["']?([^"',\s]+)["']?/gi,
    '$1=[REDACTED]'
  );

  // Replace connection string passwords
  sanitized = sanitized.replace(
    /(postgres|mysql|redis|mongodb):\/\/[^:]+:([^@]+)@/gi,
    '$1://[USER]:[REDACTED]@'
  );

  // Replace credit cards
  sanitized = sanitized.replace(/\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/g, '[REDACTED_CARD]');

  return sanitized;
}

export function redactObject<T>(obj: T): T {
  if (!obj) return obj;
  if (typeof obj === 'string') {
    return redactSensitiveData(obj) as any;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => redactObject(item)) as any;
  }
  if (typeof obj === 'object') {
    const copy: any = {};
    for (const [key, val] of Object.entries(obj)) {
      const lower = key.toLowerCase();
      if (
        lower.includes('password') ||
        lower.includes('secret') ||
        lower.includes('token') ||
        lower.includes('apikey') ||
        lower.includes('auth')
      ) {
        copy[key] = '[REDACTED]';
      } else {
        copy[key] = redactObject(val);
      }
    }
    return copy;
  }
  return obj;
}
