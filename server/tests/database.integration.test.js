import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import 'dotenv/config';

const testDatabaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const isApprovedTestDatabase = /\/detki_cms_test(?:\?|$)/.test(testDatabaseUrl || '');

test('database-backed auth, RBAC and publication CRUD', { skip: !isApprovedTestDatabase }, async () => {
  assert.match(testDatabaseUrl, /\/detki_cms_test(?:\?|$)/);
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'silent';
  const [{ createApp }, { prisma }, { hashPassword }] = await Promise.all([
    import('../src/app.js'), import('../src/db/prisma.js'), import('../src/lib/crypto.js'),
  ]);
  const suffix = randomUUID().slice(0, 8);
  const password = `Test-password-${suffix}-safe`;
  const passwordHash = await hashPassword(password);
  const admin = await prisma.user.create({ data: { email: `admin-${suffix}@example.test`, displayName: 'Test Admin', passwordHash, role: 'ADMIN' } });
  const editor = await prisma.user.create({ data: {
    email: `editor-${suffix}@example.test`, displayName: 'Test Editor', passwordHash, role: 'EDITOR',
    permissions: { create: [{ area: 'PUBLICATIONS', canPublish: false }] },
  } });
  const app = createApp();
  const login = async email => {
    const response = await request(app).post('/api/v1/auth/login').set('Origin', 'http://localhost:3001').send({ email, password }).expect(200);
    return { cookie: response.headers['set-cookie'], csrf: response.body.data.csrfToken };
  };
  const adminAuth = await login(admin.email);
  const editorAuth = await login(editor.email);

  await request(app).post('/api/v1/admin/users').set('Origin', 'http://localhost:3001').set('Cookie', editorAuth.cookie).set('X-CSRF-Token', editorAuth.csrf).send({}).expect(403);
  const slug = `integration-${suffix}`;
  const created = await request(app).post('/api/v1/admin/publications').set('Origin', 'http://localhost:3001').set('Cookie', adminAuth.cookie).set('X-CSRF-Token', adminAuth.csrf).send({
    kind: 'NEWS', slug, title: 'Integration publication', excerpt: 'Safe test fixture', body: [{ type: 'paragraph', text: 'Test only' }],
  }).expect(201);
  assert.equal(created.body.data.status, 'DRAFT');

  await request(app).post('/api/v1/admin/publications').set('Origin', 'http://localhost:3001').set('Cookie', adminAuth.cookie).send({
    kind: 'NEWS', slug: `csrf-${suffix}`, title: 'CSRF fixture', excerpt: 'Safe test fixture', body: [],
  }).expect(403);
  await request(app).post('/api/v1/admin/publications').set('Origin', 'http://localhost:3001').set('Cookie', adminAuth.cookie).set('X-CSRF-Token', adminAuth.csrf).send({
    kind: 'NEWS', slug, title: 'Duplicate slug', excerpt: 'Safe test fixture', body: [],
  }).expect(409);
  await request(app).post('/api/v1/admin/publications').set('Origin', 'http://localhost:3001').set('Cookie', adminAuth.cookie).set('X-CSRF-Token', adminAuth.csrf).send({ kind: 'NEWS' }).expect(400);

  await request(app).get(`/api/v1/public/publications/${slug}`).expect(404);
  const privateChildSlug = `private-child-${suffix}`;
  await prisma.childProfile.create({ data: {
    slug: privateChildSlug, publicDisplayName: 'Тестовая запись', title: 'Закрытая тестовая карточка', summary: 'Не публиковать', storyBody: [], supportReason: 'Тест', createdById: admin.id, updatedById: admin.id,
  } });
  await request(app).get(`/api/v1/public/children/${privateChildSlug}`).expect(404);
  const editorPublish = await request(app).post(`/api/v1/admin/publications/${created.body.data.id}/publish`).set('Origin', 'http://localhost:3001').set('Cookie', editorAuth.cookie).set('X-CSRF-Token', editorAuth.csrf).send({ version: created.body.data.version }).expect(403);
  assert.equal(editorPublish.body.error.code, 'FORBIDDEN');
  await request(app).post(`/api/v1/admin/publications/${created.body.data.id}/publish`).set('Origin', 'http://localhost:3001').set('Cookie', adminAuth.cookie).set('X-CSRF-Token', adminAuth.csrf).send({ version: created.body.data.version }).expect(200);
  const publicItem = await request(app).get(`/api/v1/public/publications/${slug}`).expect(200);
  assert.equal(publicItem.body.data.slug, slug);
  assert.equal('createdById' in publicItem.body.data, false);
  const staleUpdate = await request(app).patch(`/api/v1/admin/publications/${created.body.data.id}`).set('Origin', 'http://localhost:3001').set('Cookie', adminAuth.cookie).set('X-CSRF-Token', adminAuth.csrf).send({ version: created.body.data.version, title: 'Stale update' }).expect(409);
  assert.equal(staleUpdate.body.error.code, 'VERSION_CONFLICT');

  await request(app).post('/api/v1/admin/publications').send({}).expect(401);
  await prisma.$disconnect();
});
