import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ||= 'postgresql://unused:unused@127.0.0.1:1/unused';
process.env.LOG_LEVEL = 'silent';

const { createApp } = await import('../src/app.js');
const app = createApp();

test('health endpoint starts without exposing internals', async () => {
  const response = await request(app).get('/health').expect(200);
  assert.deepEqual(response.body, { data: { status: 'ok' } });
  assert.equal(response.headers['x-powered-by'], undefined);
});

test('credentialed admin API CORS is restricted to the admin origin', async () => {
  const publicOrigin = await request(app).get('/api/v1/admin/dashboard').set('Origin', process.env.PUBLIC_ORIGIN || 'http://localhost:3000');
  assert.equal(publicOrigin.headers['access-control-allow-origin'], undefined);
  const adminOrigin = await request(app).get('/api/v1/admin/dashboard').set('Origin', process.env.ADMIN_ORIGIN || 'http://localhost:3001');
  assert.equal(adminOrigin.headers['access-control-allow-origin'], process.env.ADMIN_ORIGIN || 'http://localhost:3001');
  assert.equal(adminOrigin.headers['access-control-allow-credentials'], 'true');
});

test('public origin may read public APIs without credentialed CORS', async () => {
  const response = await request(app).get('/api/v1/public/site').set('Origin', process.env.PUBLIC_ORIGIN || 'http://localhost:3000');
  assert.equal(response.headers['access-control-allow-origin'], process.env.PUBLIC_ORIGIN || 'http://localhost:3000');
  assert.equal(response.headers['access-control-allow-credentials'], undefined);
});

test('anonymous admin mutation is rejected', async () => {
  const response = await request(app).post('/api/v1/admin/publications').send({}).expect(401);
  assert.equal(response.body.error.code, 'AUTHENTICATION_REQUIRED');
});

test('private media stream requires an authenticated admin session', async () => {
  const response = await request(app).get('/api/v1/admin/media/00000000-0000-4000-8000-000000000000/content').expect(401);
  assert.equal(response.body.error.code, 'AUTHENTICATION_REQUIRED');
});

test('public media endpoint rejects malformed identifiers before database access', async () => {
  const response = await request(app).get('/api/v1/public/media/not-a-uuid').expect(400);
  assert.equal(response.body.error.code, 'VALIDATION_ERROR');
  assert.ok(response.body.error.fields.id);
});

test('public page endpoint rejects unknown groups without querying the database', async () => {
  const response = await request(app).get('/api/v1/public/pages/NOT_A_GROUP/example').expect(404);
  assert.equal(response.body.error.code, 'NOT_FOUND');
});

test('malformed JSON produces a stable client error', async () => {
  const response = await request(app)
    .post('/api/v1/auth/login')
    .set('Content-Type', 'application/json')
    .send('{broken')
    .expect(400);
  assert.equal(response.body.error.code, 'INVALID_JSON');
  assert.ok(response.body.error.requestId);
});

test('public registration endpoint does not exist', async () => {
  await request(app).post('/api/v1/auth/register').send({}).expect(404);
});

test('login validates input before database access', async () => {
  const response = await request(app).post('/api/v1/auth/login').set('Origin', 'http://localhost:3001').send({ email: 'bad', password: 'short' }).expect(400);
  assert.equal(response.body.error.code, 'VALIDATION_ERROR');
});

test('login rejects an untrusted Origin', async () => {
  const response = await request(app).post('/api/v1/auth/login').set('Origin', 'https://attacker.example').send({ email: 'a@example.com', password: 'long enough password' }).expect(403);
  assert.equal(response.body.error.code, 'FORBIDDEN');
});
