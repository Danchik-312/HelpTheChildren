import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL = 'postgresql://unused:unused@127.0.0.1:1/unused';
const [{ prisma }, service, { schemas }, { publicContent }, { publicMediaIsEntitled }] = await Promise.all([
  import('../src/db/prisma.js'),
  import('../src/modules/content/content.service.js'),
  import('../src/modules/content/content.validation.js'),
  import('../src/modules/content/content.presenter.js'),
  import('../src/modules/media/media.service.js'),
]);

const actor = { id: 'editor-id', role: 'EDITOR' };
const publicationId = 'publication-id';
const firstId = '123e4567-e89b-42d3-a456-426614174000';
const secondId = '123e4567-e89b-42d3-a456-426614174001';
const doc = { type: 'doc', content: [{ type: 'paragraph' }] };
const inlineDoc = { type: 'doc', content: [{ type: 'image', attrs: { mediaId: firstId, alt: 'Inline' } }] };
const first = { mediaId: firstId, altText: 'Фото один', caption: 'Подпись' };
const second = { mediaId: secondId, altText: '', caption: '' };

function fixture(t) {
  const original = prisma.$transaction;
  let state = { record: null, links: new Map(), audits: [], assets: new Map([firstId, secondId].map(id => [id, {
    id, kind: 'IMAGE', status: 'READY', visibility: 'PRIVATE', rightsConfirmed: true, deletedAt: null, storageKey: id,
  }])) };
  const matches = (entry, where) => entry && Object.entries(where).every(([key, value]) => entry[key] === value);
  prisma.$transaction = async run => {
    const pending = structuredClone(state);
    const recordWithMedia = () => ({
      ...pending.record,
      media: [...pending.links.values()].map(link => ({ ...link, media: pending.assets.get(link.mediaId) })),
    });
    const tx = {
      publication: {
        create: async ({ data }) => (pending.record = { id: publicationId, version: 1, status: 'DRAFT', deletedAt: null, ...data }),
        findFirst: async ({ where }) => matches(pending.record, where) ? pending.record : null,
        findUnique: async () => recordWithMedia(),
        updateMany: async ({ where, data }) => {
          if (!matches(pending.record, where)) return { count: 0 };
          const version = pending.record.version + data.version.increment;
          pending.record = { ...pending.record, ...data, version };
          return { count: 1 };
        },
      },
      publicationCategory: { deleteMany: async () => {} },
      publicationMedia: {
        deleteMany: async ({ where }) => {
          for (const id of pending.links.keys()) if (!where.mediaId?.notIn.includes(id)) pending.links.delete(id);
        },
        upsert: async ({ create }) => pending.links.set(create.mediaId, create),
      },
      mediaAsset: {
        findFirst: async ({ where }) => matches(pending.assets.get(where.id), where) ? pending.assets.get(where.id) : null,
        update: async ({ where, data }) => Object.assign(pending.assets.get(where.id), data),
      },
      auditLog: { create: async ({ data }) => pending.audits.push(data.action) },
    };
    const result = await run(tx);
    state = pending;
    return result;
  };
  t.after(() => { prisma.$transaction = original; });
  return () => state;
}

const create = (kind, body, sidePhotos) => service.create('publications', { kind, body, sidePhotos }, actor);
const update = (version, data) => service.update('publications', publicationId, { ...data, version }, actor);
const publish = (version, visible) => service.setPublication('publications', publicationId, version, visible, actor);

test('news without photos keeps its legacy document shape and empty admin selection', async t => {
  const state = fixture(t);
  const result = await create('NEWS', doc);
  assert.deepEqual(result.body, doc);
  assert.deepEqual(result.sidePhotos, []);
  assert.deepEqual(state().record.body, doc);
});

test('article gallery survives body edits and shares one relation per image', async t => {
  const state = fixture(t);
  await create('ARTICLE', inlineDoc, [second, first]);
  assert.deepEqual([...state().links.keys()], [firstId, secondId]);
  let saved = await update(1, { body: doc });
  assert.deepEqual(saved.body, doc);
  assert.deepEqual(saved.sidePhotos.map(photo => photo.mediaId), [secondId, firstId]);
  assert.equal(saved.sidePhotos[1].caption, first.caption);
  saved = await update(2, { sidePhotos: [first, second], body: inlineDoc });
  assert.deepEqual(saved.sidePhotos.map(photo => photo.mediaId), [firstId, secondId]);
  await assert.rejects(update(2, { sidePhotos: [] }), { code: 'VERSION_CONFLICT' });
  await update(3, { sidePhotos: [] });
  assert.deepEqual([...state().links.keys()], [firstId]);
  assert.deepEqual(state().record.body, inlineDoc);
});

test('publication checks readiness and rights, and unpublish removes public entitlement', async t => {
  const state = fixture(t);
  state().assets.get(firstId).status = 'FAILED';
  await assert.rejects(create('ARTICLE', doc, [first]), { status: 422 });
  assert.equal(state().record, null);
  state().assets.get(firstId).status = 'READY';
  state().assets.get(firstId).rightsConfirmed = false;
  await create('ARTICLE', doc, [first]);
  await assert.rejects(publish(1, true), { status: 422 });
  assert.equal(state().record.status, 'DRAFT');
  assert.equal(state().record.version, 1);
  state().assets.get(firstId).rightsConfirmed = true;
  const published = await publish(1, true);
  const entitlement = () => publicMediaIsEntitled({ id: firstId, publicationLinks: [{ publication: state().record }] });
  assert.equal(published.status, 'PUBLISHED');
  assert.equal(entitlement(), true);
  assert.equal(state().assets.get(firstId).visibility, 'PUBLIC');
  state().assets.get(secondId).rightsConfirmed = false;
  await assert.rejects(update(2, { sidePhotos: [second] }), { status: 422 });
  assert.deepEqual([...state().links.keys()], [firstId]);
  await publish(2, false);
  assert.equal(entitlement(), false);
  assert.deepEqual(state().audits, ['CREATE', 'PUBLISH', 'UNPUBLISH']);
});

test('public details filter revoked or private photos and keep editor metadata separate', async t => {
  const state = fixture(t);
  await create('ARTICLE', doc, [second, first]);
  await publish(1, true);
  state().assets.get(secondId).visibility = 'PRIVATE';
  const row = { ...state().record, media: [...state().links.values()].map(link => ({ ...link, media: state().assets.get(link.mediaId) })) };
  const result = publicContent('publications', row);
  assert.deepEqual(result.body, doc);
  assert.deepEqual(result.sidePhotos, [{ ...first, url: result.sidePhotos[0].url }]);
  assert.ok(result.sidePhotos[0].url.endsWith(firstId));
  const asset = state().assets.get(firstId);
  asset.childCovers = [{ status: 'DRAFT', coverMediaId: firstId }];
  assert.deepEqual(publicContent('publications', row).sidePhotos, []);
  asset.childCovers = [];
  asset.rightsConfirmed = false;
  assert.deepEqual(publicContent('publications', row).sidePhotos, []);
});

test('gallery validation rejects duplicate IDs and untrusted URLs', () => {
  const patch = schemas.publications.partial();
  assert.equal(patch.safeParse({ sidePhotos: [first, first] }).success, false);
  assert.equal(patch.safeParse({ sidePhotos: [{ ...first, url: 'https://example.test/a.png' }] }).success, false);
  assert.deepEqual(patch.parse({ sidePhotos: [{ mediaId: firstId }] }).sidePhotos, [{ ...first, altText: '', caption: '' }]);
});
