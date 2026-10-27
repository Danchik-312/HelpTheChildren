import { createHash, createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { env } from '../config/env.js';

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');
export const hashToken = value => createHash('sha256').update(value).digest('hex');
const csrfSigningSecret = env.CSRF_HMAC_SECRET || randomBytes(32);

// Production uses a persistent server-only secret. Development gets a strong,
// process-local random secret; configure the same secret across production nodes.
export function deriveCsrfToken(sessionToken) {
  if (typeof sessionToken !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(sessionToken)) {
    throw new TypeError('Invalid session token');
  }
  return `v1.${createHmac('sha256', csrfSigningSecret)
    .update('detki-cms:csrf-token:v1:')
    .update(sessionToken)
    .digest('base64url')}`;
}

export function safeHashEquals(actual, expected) {
  if (typeof actual !== 'string' || typeof expected !== 'string' ||
      !/^[a-f0-9]{64}$/i.test(actual) || !/^[a-f0-9]{64}$/i.test(expected)) return false;
  return timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('base64url');
  const key = await scrypt(password, salt, KEY_LENGTH, SCRYPT_OPTIONS);
  return `scrypt$${SCRYPT_OPTIONS.N}$${SCRYPT_OPTIONS.r}$${SCRYPT_OPTIONS.p}$${salt}$${Buffer.from(key).toString('base64url')}`;
}

export async function verifyPassword(password, encoded) {
  const [algorithm, n, r, p, salt, expected] = String(encoded).split('$');
  if (algorithm !== 'scrypt' || !salt || !expected) return false;
  const expectedBuffer = Buffer.from(expected, 'base64url');
  const actual = await scrypt(password, salt, expectedBuffer.length, {
    N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024,
  });
  return expectedBuffer.length === actual.length && timingSafeEqual(expectedBuffer, actual);
}
