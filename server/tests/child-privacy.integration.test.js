import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import 'dotenv/config';

const testDatabaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const isApprovedTestDatabase = /\/detki_cms_test(?:\?|$)/.test(testDatabaseUrl || '');

test('ADMIN can publish a child card without the removed consent workflow', { skip: !isApprovedTestDatabase }, async () => {
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
  let admin;
  let editor;
  let childId;
  try {
    admin = await prisma.user.create({ data: { email: `child-admin-${suffix}@example.test`, displayName: 'Child Admin', passwordHash, role: 'ADMIN' } });
    editor = await prisma.user.create({ data: {
      email: `child-editor-${suffix}@example.test`, displayName: 'Child Editor', passwordHash, role: 'EDITOR',
      permissions: { create: [{ area: 'CHILDREN', canPublish: true }] },
    } });
    const app = createApp();
    const login = async email => {
      const response = await request(app).post('/api/v1/auth/login').set('Origin', 'http://localhost:3001').send({ email, password }).expect(200);
      return { cookie: response.headers['set-cookie'], csrf: response.body.data.csrfToken };
    };
    const adminAuth = await login(admin.email);
    const editorAuth = await login(editor.email);
    const auth = value => ({ Cookie: value.cookie, 'X-CSRF-Token': value.csrf, Origin: 'http://localhost:3001' });
    const slug = `child-publication-${suffix}`;
    const created = await request(app).post('/api/v1/admin/children').set(auth(adminAuth)).send({
      slug, publicDisplayName: 'Псевдоним', title: 'Тестовая карточка', summary: 'Описание',
      storyBody: [], supportReason: 'Причина помощи', sortOrder: 0,
    }).expect(201);
    childId = created.body.data.id;

    await request(app).post(`/api/v1/admin/children/${childId}/publish`).set(auth(editorAuth)).send({ version: created.body.data.version }).expect(403);
    const published = await request(app).post(`/api/v1/admin/children/${childId}/publish`).set(auth(adminAuth)).send({ version: created.body.data.version }).expect(200);
    assert.equal(published.body.data.status, 'PUBLISHED');
    await request(app).get(`/api/v1/public/children/${slug}`).expect(200).expect('Cache-Control', 'private, no-store');

    const unpublished = await request(app).post(`/api/v1/admin/children/${childId}/unpublish`).set(auth(adminAuth)).send({ version: published.body.data.version }).expect(200);
    assert.equal(unpublished.body.data.status, 'DRAFT');
    await request(app).get(`/api/v1/public/children/${slug}`).expect(404);
  } finally {
    if (childId) await prisma.childProfile.deleteMany({ where: { id: childId } });
    const userIds = [admin?.id, editor?.id].filter(Boolean);
    if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  }
});
