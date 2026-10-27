import test from 'node:test';
import assert from 'node:assert/strict';
import pino from 'pino';

process.env.DATABASE_URL ||= 'postgresql://unused:unused@127.0.0.1:1/unused';
const { sensitiveLogPaths } = await import('../src/app.js');

test('request logging redacts authentication, session and CSRF material', async () => {
  let output = '';
  const destination = { write: chunk => { output += chunk; } };
  const logger = pino({ redact: { paths: sensitiveLogPaths, censor: '[Redacted]' } }, destination);
  const values = ['bearer-secret', 'session-secret', 'csrf-secret', 'password-secret', 'response-cookie-secret'];
  logger.info({
    req: {
      headers: { authorization: values[0], cookie: values[1], 'x-csrf-token': values[2] },
      body: { password: values[3], csrfToken: values[2] },
    },
    res: { headers: { 'set-cookie': values[4] } },
  }, 'safe test request');
  for (const value of values) assert.equal(output.includes(value), false);
  assert.match(output, /\[Redacted\]/);
});
