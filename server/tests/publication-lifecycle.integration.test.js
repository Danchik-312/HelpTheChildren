import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import 'dotenv/config';

const testDatabaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const isApprovedTestDatabase = /\/detki_cms_test(?:\?|$)/.test(testDatabaseUrl || '');

test('ADMIN publication lifecycle keeps drafts private and serves published structured media', { skip: !isApprovedTestDatabase }, async () => {
  assert.match(testDatabaseUrl, /\/detki_cms_test(?:\?|$)/);
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'silent';

  const [{ createApp }, { prisma }, { hashPassword }] = await Promise.all([
    import('../src/app.js'),
    import('../src/db/prisma.js'),
    import('../src/lib/crypto.js'),
  ]);

  const fixtureId = randomUUID();
  const adminId = randomUUID();
  const password = `Integration-${randomUUID()}-safe`;
  const slug = `publication-lifecycle-${fixtureId}`;
  let publicationId = null;
  let mediaId = null;
  let storageKey = null;

  try {
    await prisma.user.create({
      data: {
        id: adminId,
        email: `publication-admin-${fixtureId}@example.test`,
        displayName: 'Publication lifecycle admin',
        passwordHash: await hashPassword(password),
        role: 'ADMIN',
      },
    });

    const app = createApp();
    const login = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:3001')
      .send({ email: `publication-admin-${fixtureId}@example.test`, password })
      .expect(200);
    const auth = {
      Origin: 'http://localhost:3001',
      Cookie: login.headers['set-cookie'],
      'X-CSRF-Token': login.body.data.csrfToken,
    };

    const image = await sharp({
      create: { width: 2, height: 2, channels: 3, background: '#68bce8' },
    }).png().toBuffer();
    const uploaded = await request(app)
      .post('/api/v1/admin/media')
      .set(auth)
      .field('defaultAlt', 'Безопасное тестовое изображение')
      .field('rightsConfirmed', 'true')
      .attach('file', image, { filename: `publication-${fixtureId}.png`, contentType: 'image/png' })
      .expect(201);
    mediaId = uploaded.body.data.id;
    storageKey = uploaded.body.data.storageKey;
    assert.match(mediaId, /^[0-9a-f-]{36}$/i);
    assert.equal(uploaded.body.data.rightsConfirmed, true);

    const body = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Тестовый заголовок' }] },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Абзац со ' },
            { type: 'text', text: 'ссылкой', marks: [{ type: 'link', attrs: { href: '/contacts' } }] },
          ],
        },
        {
          type: 'bulletList',
          content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Пункт списка' }] }] }],
        },
        { type: 'image', attrs: { mediaId, alt: 'Изображение внутри публикации', title: null } },
      ],
    };

    const created = await request(app)
      .post('/api/v1/admin/publications')
      .set(auth)
      .send({
        kind: 'NEWS',
        slug,
        title: 'Тестовая новость жизненного цикла',
        excerpt: 'Изолированная интеграционная запись.',
        body,
        coverMediaId: mediaId,
      })
      .expect(201);
    publicationId = created.body.data.id;
    assert.equal(created.body.data.status, 'DRAFT');

    await request(app).get(`/api/v1/public/publications/${slug}`).expect(404);
    await request(app).get(`/api/v1/public/media/${mediaId}`).expect(404);

    const published = await request(app)
      .post(`/api/v1/admin/publications/${publicationId}/publish`)
      .set(auth)
      .send({ version: created.body.data.version })
      .expect(200);
    assert.equal(published.body.data.status, 'PUBLISHED');

    const publicDetail = await request(app).get(`/api/v1/public/publications/${slug}`).expect(200);
    assert.equal(publicDetail.body.data.title, 'Тестовая новость жизненного цикла');
    assert.deepEqual(publicDetail.body.data.body, body);
    assert.equal(publicDetail.body.data.coverMedia.id, mediaId);
    assert.match(publicDetail.body.data.coverMedia.url, new RegExp(`/api/v1/public/media/${mediaId}$`));
    await request(app)
      .get(`/api/v1/public/media/${mediaId}`)
      .expect(200)
      .expect('Content-Type', /image\/png/);

    const updatedBody = {
      ...body,
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Обновлённый заголовок' }] },
        ...body.content.slice(1),
      ],
    };
    const updated = await request(app)
      .patch(`/api/v1/admin/publications/${publicationId}`)
      .set(auth)
      .send({ version: published.body.data.version, title: 'Обновлённая тестовая новость', body: updatedBody })
      .expect(200);
    assert.equal(updated.body.data.version, published.body.data.version + 1);

    const publicUpdated = await request(app).get(`/api/v1/public/publications/${slug}`).expect(200);
    assert.equal(publicUpdated.body.data.title, 'Обновлённая тестовая новость');
    assert.deepEqual(publicUpdated.body.data.body, updatedBody);

    const unpublished = await request(app)
      .post(`/api/v1/admin/publications/${publicationId}/unpublish`)
      .set(auth)
      .send({ version: updated.body.data.version })
      .expect(200);
    assert.equal(unpublished.body.data.status, 'DRAFT');
    await request(app).get(`/api/v1/public/publications/${slug}`).expect(404);
    await request(app).get(`/api/v1/public/media/${mediaId}`).expect(404);
  } finally {
    if (publicationId) {
      await prisma.publicationMedia.deleteMany({ where: { publicationId } });
      await prisma.publicationCategory.deleteMany({ where: { publicationId } });
      await prisma.publication.deleteMany({ where: { id: publicationId } });
    }
    if (mediaId) await prisma.mediaAsset.deleteMany({ where: { id: mediaId } });
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { actorId: adminId },
          { entityType: 'User', entityId: adminId },
          ...(publicationId ? [{ entityType: 'Publication', entityId: publicationId }] : []),
          ...(mediaId ? [{ entityType: 'MediaAsset', entityId: mediaId }] : []),
        ],
      },
    });
    await prisma.session.deleteMany({ where: { userId: adminId } });
    await prisma.userContentPermission.deleteMany({ where: { userId: adminId } });
    await prisma.user.deleteMany({ where: { id: adminId } });

    if (storageKey && /^[a-f0-9-]+\.[a-z0-9]+$/.test(storageKey)) {
      const privateRoot = path.resolve(process.cwd(), process.env.MEDIA_STORAGE_ROOT || './storage', 'private');
      const storedFile = path.resolve(privateRoot, storageKey);
      if (storedFile.startsWith(`${privateRoot}${path.sep}`)) await rm(storedFile, { force: true });
    }
    await prisma.$disconnect();
  }
});
