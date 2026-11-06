import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL ||= 'postgresql://unused:unused@127.0.0.1:1/unused';
const { publicWhere } = await import('../src/modules/content/content.repository.js');
const { infoPagePublicUrl } = await import('../src/routes/public.routes.js');

test('public content queries always restrict results to currently published records', () => {
  for (const resource of ['publications', 'stories', 'children', 'projects', 'pages']) {
    const where = publicWhere(resource, { slug: 'draft-record' });
    assert.equal(where.status, 'PUBLISHED');
    assert.equal(where.deletedAt, null);
    assert.ok(where.publishedAt.lte instanceof Date);
    if (resource === 'children') {
      assert.equal(Object.hasOwn(where, 'privacyReviewStatus'), false);
      assert.equal(Object.hasOwn(where, 'consents'), false);
    }
  }
});

test('caller filters cannot override public publication guards', () => {
  const where = publicWhere('publications', { status: 'DRAFT', deletedAt: new Date(), slug: 'draft-record' });
  assert.equal(where.status, 'PUBLISHED');
  assert.equal(where.deletedAt, null);
});

test('search page URLs only target existing React routes', () => {
  assert.equal(infoPagePublicUrl({ group: 'ABOUT', slug: 'team' }), '/who-we/team');
  assert.equal(infoPagePublicUrl({ group: 'GIVE_HELP', slug: 'volunteer' }), '/give-help/volunteer');
  assert.equal(infoPagePublicUrl({ group: 'GET_HELP', slug: 'application' }), '/get-help/application');
  assert.equal(infoPagePublicUrl({ group: 'GENERAL', slug: 'documents' }), '/information/documents');
  assert.equal(infoPagePublicUrl({ group: 'GENERAL', slug: 'partners' }), '/partners');
});
