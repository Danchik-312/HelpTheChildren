import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL ||= 'postgresql://unused:unused@127.0.0.1:1/unused';

const { heroMediaPublicationIssue, toPublicHeroSlide } = await import('../src/modules/hero/hero.service.js');
const { contactPatchSchema, contactSchema, organizationSchema } = await import('../src/modules/site/site.validation.js');
const { heroSchema } = await import('../src/modules/hero/hero.validation.js');
const { externalVideoSchema } = await import('../src/modules/media/media.validation.js');
const { sanitizePublicSiteData } = await import('../src/modules/site/site.service.js');
const { normalizeExternalVideoUrl, publicMediaUrl } = await import('../src/lib/public-media-url.js');
const { parseEnvironment } = await import('../src/config/env.js');

const image = {
  id: 'image-id', kind: 'IMAGE', status: 'READY', visibility: 'PRIVATE', rightsConfirmed: true,
  storageKey: 'image.webp', externalUrl: null, deletedAt: null, defaultAlt: 'Описание',
};

const video = {
  id: 'video-id', kind: 'VIDEO', status: 'READY', visibility: 'PRIVATE', rightsConfirmed: true,
  storageKey: 'video.mp4', externalUrl: null, deletedAt: null, defaultAlt: '',
};

test('Hero publication validates readiness, rights, deletion, source and media kind', () => {
  assert.equal(heroMediaPublicationIssue(image), null);
  assert.match(heroMediaPublicationIssue({ ...image, status: 'PROCESSING' }), /не готово/);
  assert.match(heroMediaPublicationIssue({ ...image, rightsConfirmed: false }), /не подтверждены/);
  assert.match(heroMediaPublicationIssue({ ...image, deletedAt: new Date() }), /удалено/);
  assert.match(heroMediaPublicationIssue({ ...image, storageKey: null }), /источник/);
  assert.match(heroMediaPublicationIssue({ ...image, kind: 'DOCUMENT' }), /только изображения и видео/);
});

test('Hero CTA accepts only same-origin paths, not protocol-relative URLs', () => {
  const slide = { subtitle: 'Описание', mediaId: '00000000-0000-4000-8000-000000000000', altText: 'Баннер', ctaUrl: '/help/children' };
  assert.equal(heroSchema.safeParse(slide).success, true);
  assert.equal(heroSchema.safeParse({ ...slide, ctaUrl: '//attacker.example/path' }).success, false);
});

test('Hero poster must independently be a ready rights-cleared image', () => {
  assert.equal(heroMediaPublicationIssue(image, 'poster'), null);
  assert.match(heroMediaPublicationIssue(video, 'poster'), /изображением/);
  assert.match(heroMediaPublicationIssue({ ...image, rightsConfirmed: false }, 'poster'), /не подтверждены/);
  assert.match(heroMediaPublicationIssue({ ...image, status: 'REJECTED' }, 'poster'), /не готово/);
});

test('public Hero projection omits drafts and slides with private or unsafe media', () => {
  const slide = {
    id: 'slide-id', status: 'PUBLISHED', publishedAt: new Date(Date.now() - 1000), deletedAt: null,
    title: 'Hero', subtitle: 'Описание', media: { ...image, visibility: 'PUBLIC' }, posterMedia: null,
    altText: 'Описание', isDecorative: false, ctaLabel: null, ctaUrl: null, position: 0,
  };
  assert.equal(toPublicHeroSlide(slide)?.id, 'slide-id');
  assert.equal(toPublicHeroSlide(slide)?.media.url, 'http://localhost:4000/api/v1/public/media/image-id');
  assert.equal(toPublicHeroSlide({ ...slide, status: 'DRAFT' }), null);
  assert.equal(toPublicHeroSlide({ ...slide, altText: null }), null);
  assert.equal(toPublicHeroSlide({ ...slide, media: image }), null);
  assert.equal(toPublicHeroSlide({ ...slide, media: { ...image, visibility: 'PUBLIC', rightsConfirmed: false } }), null);
});

test('public media URLs use configured API origin and reject unapproved external hosts', () => {
  assert.equal(publicMediaUrl(image), 'http://localhost:4000/api/v1/public/media/image-id');
  assert.equal(publicMediaUrl({ id: 'video', kind: 'EXTERNAL_VIDEO', externalUrl: 'https://youtube.com/watch?v=AbCdEf123_-&feature=share' }), 'https://www.youtube.com/embed/AbCdEf123_-');
  assert.equal(publicMediaUrl({ id: 'video', kind: 'EXTERNAL_VIDEO', externalUrl: 'https://attacker.example/video' }), null);
  assert.equal(publicMediaUrl({ id: 'video', kind: 'EXTERNAL_VIDEO', externalUrl: 'https://user:password@youtube.com/video' }), null);
  assert.equal(publicMediaUrl(image, 'https://media.example.org/cms/assets'), 'https://media.example.org/cms/assets/image-id');
});

test('external provider links normalize to strict embed URLs and invalid paths are rejected', () => {
  assert.equal(normalizeExternalVideoUrl('https://youtu.be/AbCdEf123_-')?.toString(), 'https://www.youtube.com/embed/AbCdEf123_-');
  assert.equal(normalizeExternalVideoUrl('https://www.youtube.com/embed/AbCdEf123_-')?.toString(), 'https://www.youtube.com/embed/AbCdEf123_-');
  assert.equal(normalizeExternalVideoUrl('https://vimeo.com/123456789')?.toString(), 'https://player.vimeo.com/video/123456789');
  assert.equal(normalizeExternalVideoUrl('https://player.vimeo.com/video/123456789')?.toString(), 'https://player.vimeo.com/video/123456789');
  assert.equal(normalizeExternalVideoUrl('https://youtube.com/channel/AbCdEf123_-'), null);
  assert.equal(normalizeExternalVideoUrl('https://vimeo.com/channels/staffpicks/123456789'), null);
  assert.equal(normalizeExternalVideoUrl('https://youtu.be/not-valid'), null);
});

test('external video payload rejects credentials before service processing', () => {
  const input = { url: 'https://youtube.com/watch?v=AbCdEf123_-', defaultAlt: 'Видео', rightsConfirmed: true };
  assert.equal(externalVideoSchema.safeParse(input).success, true);
  assert.equal(externalVideoSchema.safeParse({ ...input, url: 'https://user:password@youtube.com/video' }).success, false);
});

test('production media base must be explicit and credential-free', () => {
  const production = { DATABASE_URL: 'postgresql://db.invalid/test', NODE_ENV: 'production', CSRF_HMAC_SECRET: 'x'.repeat(32) };
  assert.throws(() => parseEnvironment(production), /MEDIA_PUBLIC_BASE_URL/);
  assert.throws(() => parseEnvironment({ ...production, MEDIA_PUBLIC_BASE_URL: 'https://user:password@cdn.example/media' }), /MEDIA_PUBLIC_BASE_URL/);
  assert.equal(parseEnvironment({ ...production, MEDIA_PUBLIC_BASE_URL: 'https://cdn.example/media' }).MEDIA_PUBLIC_BASE_URL, 'https://cdn.example/media');
});

test('public video Hero requires a safe public poster', () => {
  const slide = {
    id: 'slide-id', status: 'PUBLISHED', publishedAt: new Date(Date.now() - 1000), deletedAt: null,
    title: 'Video', subtitle: 'Описание', media: { ...video, visibility: 'PUBLIC' }, posterMedia: null,
    altText: 'Описание', isDecorative: false, ctaLabel: null, ctaUrl: null, position: 0,
  };
  assert.equal(toPublicHeroSlide(slide), null);
  assert.equal(toPublicHeroSlide({ ...slide, posterMedia: { ...image, visibility: 'PUBLIC' } })?.id, 'slide-id');
  assert.equal(toPublicHeroSlide({ ...slide, posterMedia: { ...image, visibility: 'PRIVATE' } }), null);
});

test('site validation rejects scriptable contact links and arbitrary organization HTML', () => {
  const contact = { type: 'SOCIAL', label: 'Сеть', value: 'Профиль', href: 'javascript:alert(1)', isPublic: true, sortOrder: 0 };
  assert.equal(contactSchema.safeParse(contact).success, false);
  assert.equal(contactSchema.safeParse({ ...contact, href: 'https://example.org/profile' }).success, true);
  assert.equal(contactSchema.safeParse({ ...contact, href: 'https://user:password@example.org/profile' }).success, false);
  assert.equal(organizationSchema.safeParse({ displayName: 'Фонд', description: { type: 'doc', content: [{ type: 'html', attrs: { html: '<script>alert(1)</script>' } }] } }).success, false);
});

test('contact PATCH preserves omitted flags and accepts an explicit false', () => {
  const labelOnly = contactPatchSchema.parse({ label: 'Новая подпись' });
  assert.deepEqual(labelOnly, { label: 'Новая подпись' });
  assert.equal(Object.hasOwn(labelOnly, 'isPublic'), false);
  assert.deepEqual(contactPatchSchema.parse({ isPublic: false }), { isPublic: false });
  assert.equal(contactPatchSchema.safeParse({}).success, false);
});

test('public site response neutralizes unsafe legacy links and organization content', () => {
  const result = sanitizePublicSiteData({
    organization: { displayName: 'Фонд', description: { html: '<script>alert(1)</script>' } },
    contacts: [{ id: 'contact-id', href: 'javascript:alert(1)' }],
    blocks: [],
  });
  assert.equal(result.organization.description, null);
  assert.equal(result.contacts[0].href, null);
});

test('organization colors use normalized six-digit HEX and remain optional', () => {
  const organization = { displayName: 'Фонд' };
  assert.deepEqual(organizationSchema.parse(organization), organization);
  assert.deepEqual(organizationSchema.parse({ ...organization, brandColor: '#0a1b2c', accentColor: '#fedcba' }), {
    ...organization, brandColor: '#0A1B2C', accentColor: '#FEDCBA',
  });
  for (const value of ['#abc', '#12345678', '#12zzff', 'url(example.test)', null]) {
    assert.equal(organizationSchema.safeParse({ ...organization, brandColor: value }).success, false);
    assert.equal(organizationSchema.safeParse({ ...organization, accentColor: value }).success, false);
  }
});

test('site settings persist colors through the audited update and expose them publicly', async t => {
  const { prisma } = await import('../src/db/prisma.js');
  const user = { id: 'admin-id' };
  const { updateOrganization, publicGet } = await import('../src/modules/site/site.service.js');
  const input = organizationSchema.parse({ displayName: 'Фонд', brandColor: '#0a1b2c', accentColor: '#fedcba' });
  let stored = { id: 'main', displayName: 'Фонд', brandColor: '#DC6601', accentColor: '#BFFF00' };
  const audits = [];
  function stub(target, key, implementation) {
    const original = target[key];
    target[key] = implementation;
    t.after(() => { target[key] = original; });
  }
  stub(prisma, '$transaction', async query => Array.isArray(query)
    ? Promise.all(query)
    : query({
      organizationProfile: {
        upsert: async ({ update }) => (stored = { ...stored, ...update }),
      },
      auditLog: { create: async ({ data }) => audits.push(data) },
    }));
  stub(prisma.organizationProfile, 'findUnique', async ({ select }) =>
    Object.fromEntries(Object.keys(select).map(key => [key, stored[key]])));
  stub(prisma.contactEntry, 'findMany', async () => []);
  stub(prisma.homeBlock, 'findMany', async () => []);

  await updateOrganization(input, user, 'request-id');
  await updateOrganization(organizationSchema.parse({ displayName: 'Новое название' }), user, 'next-request');
  const { organization } = await publicGet();
  assert.equal(organization.displayName, 'Новое название');
  assert.equal(organization.brandColor, '#0A1B2C');
  assert.equal(organization.accentColor, '#FEDCBA');
  assert.equal(organization.updatedById, undefined);
  assert.equal(audits.length, 2);
  assert.equal(audits[0].actorId, user.id);
});
