import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { hashToken, randomToken, deriveCsrfToken } from '../src/lib/crypto.js';
import { csrfProtection, requireAdminOrigin } from '../src/middleware/csrf.js';

const adminOrigin = process.env.ADMIN_ORIGIN || 'http://localhost:3001';

function runMiddleware(middleware, req) {
  return new Promise(resolve => middleware(req, {}, error => resolve(error || null)));
}

function mutationRequest({ origin = adminOrigin, token, csrfHash }) {
  const headers = { origin, 'x-csrf-token': token };
  return {
    method: 'POST',
    get: name => headers[name.toLowerCase()],
    auth: { session: { csrfHash } },
  };
}

test('CSRF token is stable per opaque session token and distinct across sessions', () => {
  const sessionToken = randomToken();
  const csrfToken = deriveCsrfToken(sessionToken);
  assert.match(csrfToken, /^v1\.[A-Za-z0-9_-]{43}$/);
  assert.equal(deriveCsrfToken(sessionToken), csrfToken);
  assert.notEqual(deriveCsrfToken(randomToken()), csrfToken);
  assert.throws(() => deriveCsrfToken('public-session-id'), TypeError);
});

test('CSRF derivation changes when the server-only HMAC secret changes', () => {
  const sessionToken = randomToken();
  const cryptoModule = new URL('../src/lib/crypto.js', import.meta.url).href;
  const script = `import { createHash } from 'node:crypto'; import { deriveCsrfToken } from ${JSON.stringify(cryptoModule)}; const token = deriveCsrfToken(${JSON.stringify(sessionToken)}); console.log(createHash('sha256').update(token).digest('hex'));`;
  const fingerprintFor = secret => execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    encoding: 'utf8',
    env: { ...process.env, NODE_ENV: 'test', CSRF_HMAC_SECRET: secret },
  }).trim();
  const firstSecret = 'first-test-only-hmac-secret-32-bytes!';
  const secondSecret = 'second-test-only-hmac-secret-32bytes';
  assert.notEqual(fingerprintFor(firstSecret), fingerprintFor(secondSecret));
});

test('parallel tab restores derive the same token and all concurrent mutations pass', async () => {
  const sessionToken = randomToken();
  // Each tab independently restores the same HttpOnly-cookie session.
  const tabTokens = await Promise.all(Array.from({ length: 8 }, async () => deriveCsrfToken(sessionToken)));
  assert.ok(tabTokens.every(token => token === tabTokens[0]));

  const csrfHash = hashToken(tabTokens[0]);
  const results = await Promise.all(tabTokens.map(token => runMiddleware(
    csrfProtection,
    mutationRequest({ token, csrfHash }),
  )));
  assert.deepEqual(results, Array(8).fill(null));
});

test('CSRF rejects missing, invalid and tampered session hashes', async () => {
  const expected = deriveCsrfToken(randomToken());
  const goodHash = hashToken(expected);
  for (const req of [
    mutationRequest({ token: undefined, csrfHash: goodHash }),
    mutationRequest({ token: 'wrong-token', csrfHash: goodHash }),
    mutationRequest({ token: expected, csrfHash: 'invalid-hash' }),
  ]) {
    const error = await runMiddleware(csrfProtection, req);
    assert.equal(error?.status, 403);
  }
});

test('CSRF rejects an untrusted Origin even with a valid token', async () => {
  const token = deriveCsrfToken(randomToken());
  const error = await runMiddleware(csrfProtection, mutationRequest({
    origin: 'https://attacker.example', token, csrfHash: hashToken(token),
  }));
  assert.equal(error?.status, 403);
});

test('admin-origin guard rejects a missing or untrusted Origin', async () => {
  for (const origin of [undefined, 'https://attacker.example']) {
    const req = { get: name => name.toLowerCase() === 'origin' ? origin : undefined };
    const error = await runMiddleware(requireAdminOrigin, req);
    assert.equal(error?.status, 403);
  }
});
