import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL ||= 'postgresql://unused:unused@127.0.0.1:1/unused';
const [{ prisma }, content, media, mediaController] = await Promise.all([
  import('../src/db/prisma.js'),
  import('../src/modules/content/content.service.js'),
  import('../src/modules/media/media.service.js'),
  import('../src/modules/media/media.controller.js'),
]);

const actor = { id: 'admin-id', role: 'ADMIN' };
const imageId = '123e4567-e89b-42d3-a456-426614174000';
const bodyWithImage = { type: 'doc', content: [{ type: 'image', attrs: { mediaId: imageId, alt: 'Портрет' } }] };

function stub(t, target, name, implementation) {
  const original = target[name];
  target[name] = implementation;
  t.after(() => { target[name] = original; });
}

test('syncing child inline media does not write legacy consentApproved', async t => {
  let linkedMedia;
  const tx = {
    childProfile: { create: async () => ({ id: 'child-id' }) },
    mediaAsset: { findFirst: async () => ({ id: imageId, status: 'READY', kind: 'IMAGE' }) },
    childMedia: {
      deleteMany: async () => {},
      upsert: async ({ create }) => { linkedMedia = [create]; },
    },
    auditLog: { create: async () => ({ id: 'audit-id' }) },
  };
  stub(t, prisma, '$transaction', async callback => callback(tx));
  await content.create('children', {
    slug: 'child', publicDisplayName: 'Псевдоним', title: 'Карточка', summary: 'Описание',
    supportReason: 'Причина', storyBody: bodyWithImage,
  }, actor, 'request-id');
  assert.deepEqual(linkedMedia, [{ childId: 'child-id', mediaId: imageId, altText: 'Портрет', position: 0 }]);
  assert.equal(Object.hasOwn(linkedMedia[0], 'consentApproved'), false);
});

test('inline-media synchronization removes stale links for every content type', async () => {
  const cases = [
    ['publications', 'publicationMedia', 'publicationId'],
    ['stories', 'storyMedia', 'storyId'],
    ['children', 'childMedia', 'childId'],
    ['projects', 'projectMedia', 'projectId'],
    ['pages', 'infoPageInlineMedia', 'pageId'],
  ];
  for (const [resource, delegateName, parentField] of cases) {
    const calls = { deleted: null, update: null };
    const tx = {
      mediaAsset: { findFirst: async () => ({ id: imageId, status: 'READY', kind: 'IMAGE' }) },
      [delegateName]: {
        deleteMany: async args => { calls.deleted = args; },
        upsert: async args => { calls.update = args.update; },
      },
    };
    await content.syncInlineMedia(tx, resource, 'parent-id', bodyWithImage);
    assert.deepEqual(calls.deleted.where.mediaId.notIn, [imageId]);
    assert.equal(calls.deleted.where[parentField], 'parent-id');
    assert.deepEqual(calls.update, { position: 0, altText: 'Портрет' });
    assert.equal(Object.hasOwn(calls.update, 'consentApproved'), false);

    await content.syncInlineMedia(tx, resource, 'parent-id', { type: 'doc', content: [] });
    assert.equal(calls.deleted.where[parentField], 'parent-id');
    assert.equal(Object.hasOwn(calls.deleted.where, 'mediaId'), false);
  }
});

test('child publication accepts ready rights-cleared media without legacy consent', async t => {
  let updated = false;
  const child = {
    id: 'child-id', version: 2, status: 'DRAFT', coverMediaId: null,
    storyBody: bodyWithImage,
    media: [{ mediaId: imageId, media: { status: 'READY', rightsConfirmed: true } }],
  };
  const tx = {
    childProfile: { findFirst: async () => child, update: async () => { updated = true; return { ...child, status: 'PUBLISHED' }; } },
    mediaAsset: {
      findFirst: async () => ({ id: imageId, status: 'READY', kind: 'IMAGE', rightsConfirmed: true }),
      update: async () => ({ id: imageId, visibility: 'PUBLIC' }),
    },
    auditLog: { create: async () => ({ id: 'audit-id' }) },
  };
  stub(t, prisma, '$transaction', async callback => callback(tx));
  await content.setPublication('children', 'child-id', 2, true, actor, 'request-id');
  assert.equal(updated, true);
});

test('EDITOR still cannot publish a child card', async t => {
  let updated = false;
  const child = { id: 'child-id', version: 2, status: 'DRAFT', coverMediaId: null, storyBody: { type: 'doc', content: [] }, media: [] };
  const tx = {
    childProfile: { findFirst: async () => child, update: async () => { updated = true; } },
    auditLog: { create: async () => ({ id: 'audit-id' }) },
  };
  stub(t, prisma, '$transaction', async callback => callback(tx));
  await assert.rejects(
    content.setPublication('children', 'child-id', 2, true, { id: 'editor-id', role: 'EDITOR' }, 'request-id'),
    error => error.status === 403,
  );
  assert.equal(updated, false);
});

test('changing a published cover atomically requires ready rights-cleared media while null remains allowed', async t => {
  let mediaApproved = false;
  let updated = false;
  let mediaIsReady = false;
  const tx = {
    publication: {
      findFirst: async () => ({ status: 'PUBLISHED' }),
      updateMany: async () => { updated = true; return { count: 1 }; },
      findUnique: async () => ({ id: 'publication-id', status: 'PUBLISHED', version: 3 }),
    },
    mediaAsset: {
      findFirst: async () => mediaIsReady ? { id: imageId, status: 'READY', rightsConfirmed: true } : null,
      update: async () => { mediaApproved = true; },
    },
    auditLog: { create: async () => ({ id: 'audit-id' }) },
  };
  stub(t, prisma, '$transaction', async callback => callback(tx));

  await assert.rejects(
    content.update('publications', 'publication-id', { version: 2, coverMediaId: imageId }, actor, 'request-id'),
    error => error.status === 422,
  );
  assert.equal(updated, false);

  mediaIsReady = true;
  await content.update('publications', 'publication-id', { version: 2, coverMediaId: imageId }, actor, 'request-id');
  assert.equal(mediaApproved, true);
  assert.equal(updated, true);

  mediaApproved = false;
  updated = false;
  await content.update('publications', 'publication-id', { version: 2, coverMediaId: null }, actor, 'request-id');
  assert.equal(mediaApproved, false);
  assert.equal(updated, true);
});

test('public stream never returns private media', async t => {
  let query;
  stub(t, prisma.mediaAsset, 'findFirst', async args => { query = args; return null; });
  await assert.rejects(media.publicStream(imageId), error => error.status === 404);
  assert.equal(query.where.visibility, 'PUBLIC');
  assert.equal(query.where.rightsConfirmed, true);
  assert.equal(query.where.deletedAt, null);
});

test('public media responses disable caches', () => {
  const headers = {};
  const stream = { on: () => stream, pipe: () => {} };
  const res = { setHeader: (name, value) => { headers[name] = value; } };
  mediaController.pipeMedia(res, { item: { mimeType: 'image/jpeg' }, stream }, 'private, no-store');
  assert.equal(headers['Cache-Control'], 'private, no-store');
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
});

test('revoking asset rights makes it private before any further public stream', async t => {
  let updateArgs;
  const tx = {
    mediaAsset: {
      updateMany: async args => { updateArgs = args; return { count: 1 }; },
      findUnique: async () => ({ id: imageId, visibility: 'PRIVATE', rightsConfirmed: false }),
    },
    auditLog: { create: async () => ({ id: 'audit-id' }) },
  };
  stub(t, prisma, '$transaction', async callback => callback(tx));
  await media.update(imageId, { rightsConfirmed: false }, actor, 'request-id');
  assert.equal(updateArgs.data.visibility, 'PRIVATE');
  assert.equal(updateArgs.data.publicApprovedAt, null);
});

test('legacy revoked consent no longer hides current published child media', () => {
  const nowPast = new Date(Date.now() - 60_000);
  const item = {
    id: imageId, status: 'READY', visibility: 'PUBLIC', deletedAt: null, storageKey: 'private-image.png',
    childCovers: [],
    childLinks: [{ child: {
      id: 'child-id', status: 'PUBLISHED', privacyReviewStatus: 'APPROVED', deletedAt: null,
      publishedAt: nowPast, publicDisplayName: 'Псевдоним', title: 'Карточка', summary: 'Описание',
      storyBody: bodyWithImage, supportReason: 'Причина', coverMediaId: null,
      consents: [{ status: 'REVOKED', revokedAt: new Date(), obtainedAt: nowPast, expiresAt: null, scope: { publicDisplayName: true, title: true, summary: true, storyBody: true, supportReason: true, media: true } }],
      media: [{ mediaId: imageId, consentApproved: false }],
    } }],
  };
  assert.equal(media.publicMediaIsEntitled(item), true);
});

test('public stream rejects a formerly approved child image removed from the current body', async t => {
  const nowPast = new Date(Date.now() - 60_000);
  const item = {
    id: imageId, status: 'READY', visibility: 'PUBLIC', deletedAt: null, storageKey: 'old-image.png',
    childCovers: [],
    childLinks: [{ child: {
      id: 'child-id', status: 'PUBLISHED', deletedAt: null,
      publishedAt: nowPast, publicDisplayName: 'Псевдоним', title: 'Карточка', summary: 'Описание',
      storyBody: { type: 'doc', content: [{ type: 'paragraph' }] }, supportReason: 'Причина', coverMediaId: null,
      media: [{ mediaId: imageId }],
    } }],
  };
  stub(t, prisma.mediaAsset, 'findFirst', async () => item);
  await assert.rejects(media.publicStream(imageId), error => error.status === 404);
});
