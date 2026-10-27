import test from 'node:test';
import assert from 'node:assert/strict';
import { childMediaArePublishable, isChildPubliclyVisible } from '../src/modules/content/child-privacy.js';

const now = new Date('2026-10-12T12:00:00.000Z');

test('published child visibility depends only on the current publication state', () => {
  const child = {
    status: 'PUBLISHED', publishedAt: new Date('2026-10-10T00:00:00.000Z'), deletedAt: null,
    privacyReviewStatus: 'REVOKED', consents: [],
  };
  assert.equal(isChildPubliclyVisible(child, now), true);
  assert.equal(isChildPubliclyVisible({ ...child, status: 'DRAFT' }, now), false);
  assert.equal(isChildPubliclyVisible({ ...child, deletedAt: now }, now), false);
  assert.equal(isChildPubliclyVisible({ ...child, publishedAt: new Date('2026-10-13T00:00:00.000Z') }, now), false);
});

test('child media publication requires ready assets with confirmed rights', () => {
  const readyMedia = { status: 'READY', rightsConfirmed: true };
  assert.equal(childMediaArePublishable({ media: [] }), true);
  assert.equal(childMediaArePublishable({ media: [{ media: readyMedia, consentApproved: false }] }), true);
  assert.equal(childMediaArePublishable({ media: [{ media: { ...readyMedia, status: 'PROCESSING' } }] }), false);
  assert.equal(childMediaArePublishable({ media: [{ media: { ...readyMedia, rightsConfirmed: false } }] }), false);
});
