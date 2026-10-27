import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL ||= 'postgresql://unused:unused@127.0.0.1:1/unused';
const { publicMediaIsEntitled } = await import('../src/modules/media/media.service.js');

const now = new Date('2026-10-13T00:00:00Z');
const child = (id, overrides = {}) => ({
  id,
  status: 'PUBLISHED',
  deletedAt: null,
  publishedAt: new Date('2026-10-10T00:00:00Z'),
  publicDisplayName: `Child ${id}`,
  title: 'Support', summary: 'Summary', storyBody: { type: 'doc', content: [] }, supportReason: 'Care',
  coverMediaId: 'shared-media',
  media: [],
  ...overrides,
});

test('shared child media requires every associated child to remain publicly authorized', () => {
  const item = { id: 'shared-media', childCovers: [child('a'), child('b', { status: 'DRAFT' })], childLinks: [] };
  assert.equal(publicMediaIsEntitled(item, now), false);
  item.childCovers[1] = child('b');
  assert.equal(publicMediaIsEntitled(item, now), true);
});

test('an unreferenced public asset is not entitled after all consuming content is unpublished', () => {
  const item = { id: 'asset', publicationCovers: [{ status: 'DRAFT', deletedAt: null, publishedAt: null }] };
  assert.equal(publicMediaIsEntitled(item, now), false);
  item.publicationCovers[0] = { status: 'PUBLISHED', deletedAt: null, publishedAt: new Date('2026-10-12T00:00:00Z') };
  assert.equal(publicMediaIsEntitled(item, now), true);
});

test('inline page media is public only while its page is published and not deleted', () => {
  const item = { id: 'asset', pageInlineMedia: [{ page: { status: 'PUBLISHED', deletedAt: null, publishedAt: new Date('2026-10-12T00:00:00Z') } }] };
  assert.equal(publicMediaIsEntitled(item, now), true);
  item.pageInlineMedia[0].page.status = 'DRAFT';
  assert.equal(publicMediaIsEntitled(item, now), false);
  item.pageInlineMedia[0].page.status = 'PUBLISHED';
  item.pageInlineMedia[0].page.deletedAt = new Date();
  assert.equal(publicMediaIsEntitled(item, now), false);
});

test('inline publication media entitlement follows active publication status', () => {
  const item = { id: 'asset', publicationLinks: [{ publication: { status: 'PUBLISHED', deletedAt: null, publishedAt: new Date('2026-10-12T00:00:00Z') } }] };
  assert.equal(publicMediaIsEntitled(item, now), true);
  item.publicationLinks[0].publication.status = 'DRAFT';
  assert.equal(publicMediaIsEntitled(item, now), false);
});

test('removing one stale relation does not revoke another published entitlement', () => {
  const active = { publication: { status: 'PUBLISHED', deletedAt: null, publishedAt: new Date('2026-10-12T00:00:00Z') } };
  const stale = { publication: { status: 'DRAFT', deletedAt: null, publishedAt: null } };
  const item = { id: 'shared-asset', publicationLinks: [stale, active] };
  assert.equal(publicMediaIsEntitled(item, now), true);
  item.publicationLinks = [active];
  assert.equal(publicMediaIsEntitled(item, now), true);
});

test('legacy child consent metadata does not veto an otherwise current published relation', () => {
  const linkedChild = child('linked', {
    coverMediaId: null,
    storyBody: { type: 'doc', content: [{ type: 'image', attrs: { mediaId: 'mixed-asset' } }] },
    privacyReviewStatus: 'REVOKED',
    consents: [{ status: 'REVOKED', revokedAt: new Date('2026-10-12T00:00:00Z') }],
    media: [{ mediaId: 'mixed-asset', consentApproved: false }],
  });
  const item = { id: 'mixed-asset', childCovers: [], childLinks: [{ child: linkedChild }] };
  assert.equal(publicMediaIsEntitled(item, now), true);
});

test('inline child media requires a current relation and a current body reference', () => {
  const linked = child('inline', { coverMediaId: null, storyBody: { type: 'doc', content: [{ type: 'image', attrs: { mediaId: 'asset' } }] }, media: [{ mediaId: 'asset' }] });
  const item = { id: 'asset', childCovers: [], childLinks: [{ child: linked }] };
  assert.equal(publicMediaIsEntitled(item, now), true);
  linked.storyBody = { type: 'doc', content: [{ type: 'paragraph' }] };
  assert.equal(publicMediaIsEntitled(item, now), false);
});
