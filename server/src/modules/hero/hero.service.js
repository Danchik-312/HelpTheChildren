import { prisma } from '../../db/prisma.js';
import { errors } from '../../lib/api-error.js';
import { writeAudit } from '../audit/audit.service.js';
import { normalizeExternalVideoUrl, publicMediaUrl } from '../../lib/public-media-url.js';

const include = { media: true, posterMedia: true };
const heroMediaKinds = new Set(['IMAGE', 'VIDEO', 'EXTERNAL_VIDEO']);

function hasUsableSource(media) {
  if (media.kind === 'EXTERNAL_VIDEO') {
    return Boolean(normalizeExternalVideoUrl(media.externalUrl));
  }
  return Boolean(media.storageKey);
}

export function heroMediaPublicationIssue(media, role = 'main', requirePublic = false) {
  if (!media || media.deletedAt) return 'Медиа не найдено или удалено.';
  if (media.status !== 'READY') return 'Медиа ещё не готово к публикации.';
  if (media.rightsConfirmed !== true) return 'Права на медиа не подтверждены.';
  if (requirePublic && media.visibility !== 'PUBLIC') return 'Медиа недоступно публично.';
  if (!['PRIVATE', 'PUBLIC'].includes(media.visibility)) return 'Некорректная видимость медиа.';
  if (role === 'poster' && media.kind !== 'IMAGE') return 'Poster Hero должен быть изображением.';
  if (role === 'main' && !heroMediaKinds.has(media.kind)) return 'Hero поддерживает только изображения и видео.';
  if (!hasUsableSource(media)) return 'У медиа отсутствует доступный источник.';
  return null;
}

const publicMedia = media => ({
  id: media.id,
  kind: media.kind,
  url: publicMediaUrl(media),
  alt: media.defaultAlt || '',
});

export function toPublicHeroSlide(item) {
  if (!item || item.status !== 'PUBLISHED' || item.deletedAt || !item.publishedAt || item.publishedAt > new Date()) return null;
  if (!item.isDecorative && !item.altText?.trim()) return null;
  if (heroMediaPublicationIssue(item.media, 'main', true)) return null;
  const isVideo = item.media.kind === 'VIDEO' || item.media.kind === 'EXTERNAL_VIDEO';
  if (isVideo && !item.posterMedia) return null;
  if (item.posterMedia && heroMediaPublicationIssue(item.posterMedia, 'poster', true)) return null;
  return { id: item.id, title: item.title, subtitle: item.subtitle, media: publicMedia(item.media), poster: item.posterMedia ? publicMedia(item.posterMedia) : null, altText: item.altText, isDecorative: item.isDecorative, ctaLabel: item.ctaLabel, ctaUrl: item.ctaUrl, position: item.position };
}

export const list = () => prisma.heroSlide.findMany({ where: { deletedAt: null }, include, orderBy: { position: 'asc' } });

export async function create(input, user, requestId) {
  const data = { ...input };
  delete data.version;
  return prisma.$transaction(async tx => {
    const item = await tx.heroSlide.create({ data: { ...data, createdById: user.id, updatedById: user.id }, include });
    await writeAudit(tx, { actorId: user.id, action: 'CREATE', entityType: 'HeroSlide', entityId: item.id, requestId });
    return item;
  });
}

export async function update(id, input, user, requestId) {
  if (!input.version) throw errors.badRequest('Для изменения требуется version.');
  const { version, ...data } = input;
  return prisma.$transaction(async tx => {
    const result = await tx.heroSlide.updateMany({ where: { id, version, deletedAt: null }, data: { ...data, updatedById: user.id, version: { increment: 1 } } });
    if (!result.count) throw errors.conflict('VERSION_CONFLICT', 'Слайд был изменён.');
    await writeAudit(tx, { actorId: user.id, action: 'UPDATE', entityType: 'HeroSlide', entityId: id, requestId });
    return tx.heroSlide.findUnique({ where: { id }, include });
  });
}

export async function publish(id, version, state, user, requestId) {
  return prisma.$transaction(async tx => {
    const slide = await tx.heroSlide.findFirst({ where: { id, version, deletedAt: null }, include });
    if (!slide) throw errors.conflict('VERSION_CONFLICT', 'Слайд был изменён или не найден.');
    if (state) {
      if (!slide.isDecorative && !slide.altText?.trim()) throw errors.unprocessable('Для недекоративного Hero требуется alt-текст.', { altText: 'Добавьте текстовое описание.' });
      const mainIssue = heroMediaPublicationIssue(slide.media, 'main');
      if (mainIssue) throw errors.unprocessable(mainIssue, { mediaId: mainIssue });
      const isVideo = slide.media.kind === 'VIDEO' || slide.media.kind === 'EXTERNAL_VIDEO';
      if (isVideo && !slide.posterMedia) throw errors.unprocessable('Для видео Hero требуется poster.', { posterMediaId: 'Добавьте poster-изображение.' });
      const posterIssue = slide.posterMedia && heroMediaPublicationIssue(slide.posterMedia, 'poster');
      if (posterIssue) throw errors.unprocessable(posterIssue, { posterMediaId: posterIssue });
      await tx.mediaAsset.update({ where: { id: slide.mediaId }, data: { visibility: 'PUBLIC', publicApprovedAt: new Date(), publicApprovedById: user.id } });
      if (slide.posterMediaId) await tx.mediaAsset.update({ where: { id: slide.posterMediaId }, data: { visibility: 'PUBLIC', publicApprovedAt: new Date(), publicApprovedById: user.id } });
    }
    const item = await tx.heroSlide.update({ where: { id }, data: { status: state ? 'PUBLISHED' : 'DRAFT', publishedAt: state ? new Date() : null, publishedById: state ? user.id : null, updatedById: user.id, version: { increment: 1 } }, include });
    await writeAudit(tx, { actorId: user.id, action: state ? 'PUBLISH' : 'UNPUBLISH', entityType: 'HeroSlide', entityId: id, requestId });
    return item;
  });
}

export async function reorder(items, user, requestId) {
  await prisma.$transaction(async tx => {
    for (const item of items) {
      const result = await tx.heroSlide.updateMany({ where: { id: item.id, version: item.version, deletedAt: null }, data: { position: item.position, version: { increment: 1 }, updatedById: user.id } });
      if (!result.count) throw errors.conflict('VERSION_CONFLICT', 'Один из слайдов был изменён.');
    }
    await writeAudit(tx, { actorId: user.id, action: 'REORDER', entityType: 'HeroSlide', summary: `${items.length} slides`, requestId });
  });
}

export async function archive(id, user, requestId) {
  await prisma.$transaction(async tx => {
    const result = await tx.heroSlide.updateMany({ where: { id, deletedAt: null }, data: { status: 'ARCHIVED', deletedAt: new Date(), updatedById: user.id, version: { increment: 1 } } });
    if (!result.count) throw errors.notFound();
    await writeAudit(tx, { actorId: user.id, action: 'ARCHIVE', entityType: 'HeroSlide', entityId: id, requestId });
  });
}

export async function publicList() {
  const items = await prisma.heroSlide.findMany({ where: { status: 'PUBLISHED', publishedAt: { lte: new Date() }, deletedAt: null }, include, orderBy: { position: 'asc' } });
  return items.map(toPublicHeroSlide).filter(Boolean);
}
