import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL ||= 'postgresql://unused:unused@127.0.0.1:1/unused';
const [{ prisma }, { env }, { randomToken, deriveCsrfToken }, { authenticate }, { csrfProtection }] = await Promise.all([
  import('../src/db/prisma.js'),
  import('../src/config/env.js'),
  import('../src/lib/crypto.js'),
  import('../src/middleware/authenticate.js'),
  import('../src/middleware/csrf.js'),
]);

function stub(t, target, name, implementation) {
  const original = target[name];
  target[name] = implementation;
  t.after(() => { target[name] = original; });
}

test('a revoked session cannot authenticate or use its otherwise valid CSRF token', async t => {
  const sessionToken = randomToken();
  stub(t, prisma.session, 'findUnique', async () => ({
    id: 'revoked-session', revokedAt: new Date(), expiresAt: new Date(Date.now() + 60_000),
    user: { id: 'user-id', status: 'ACTIVE', permissions: [] },
  }));
  const headers = { origin: env.ADMIN_ORIGIN, 'x-csrf-token': deriveCsrfToken(sessionToken) };
  const req = {
    cookies: { [env.SESSION_COOKIE_NAME]: sessionToken },
    method: 'POST',
    get: name => headers[name.toLowerCase()],
  };
  const authError = await new Promise(resolve => authenticate(req, {}, error => resolve(error || null)));
  assert.equal(authError?.status, 401);
  assert.equal(req.auth, undefined);
  const csrfError = await new Promise(resolve => csrfProtection(req, {}, error => resolve(error || null)));
  assert.equal(csrfError?.status, 403);
});
