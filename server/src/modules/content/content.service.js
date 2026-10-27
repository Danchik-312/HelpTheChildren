import { prisma } from '../../db/prisma.js';
import { errors } from '../../lib/api-error.js';
import { pagination, metaFor } from '../../lib/pagination.js';
import { writeAudit } from '../audit/audit.service.js';
import { contentConfig } from './content.config.js';
import { adminWhere, delegateFor, publicWhere } from './content.repository.js';
import { publicContent } from './content.presenter.js';
import { childMediaArePublishable } from './child-privacy.js';

const coverInclude = { coverMedia: true };
const publicationInclude = { ...coverInclude, categories: { include: { category: true } } };
const childInclude = { coverMedia: true, media: { include: { media: true } } };

const includeFor = resource => resource === 'children' ? childInclude : resource === 'publications' ? publicationInclude : coverInclude;
const inlineMediaRelations = {
  publications: { delegate: 'publicationMedia', parentField: 'publicationId' },
  stories: { delegate: 'storyMedia', parentField: 'storyId' },
  children: { delegate: 'childMedia', parentField: 'childId' },
  projects: { delegate: 'projectMedia', parentField: 'projectId' },
  pages: { delegate: 'infoPageInlineMedia', parentField: 'pageId' },
};

function inlineImages(body) {
  const ids = new Map();
  const visit = node => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'image' && node.attrs?.mediaId) {
      if (!ids.has(node.attrs.mediaId)) ids.set(node.attrs.mediaId, node.attrs.alt || null);
      return;
    }
    if (Array.isArray(node)) node.forEach(visit);
    else if (node.content) visit(node.content);
  };
  visit(body);
  return [...ids].map(([mediaId, altText], position) => ({ mediaId, altText, position }));
}

export async function syncInlineMedia(tx, resource, parentId, body) {
  const relation = inlineMediaRelations[resource];
  if (!relation) return [];
  const images = inlineImages(body);
  for (const image of images) {
    const media = await tx.mediaAsset.findFirst({ where: { id: image.mediaId, deletedAt: null, status: 'READY', kind: 'IMAGE' } });
    if (!media) throw errors.unprocessable('Inline-изображение отсутствует или не является готовым изображением.');
  }
  const delegate = tx[relation.delegate];
  const mediaIds = images.map(image => image.mediaId);
  await delegate.deleteMany({
    where: {
      [relation.parentField]: parentId,
      ...(mediaIds.length ? { mediaId: { notIn: mediaIds } } : {}),
    },
  });
  for (const image of images) {
    const identity = { [relation.parentField]: parentId, mediaId: image.mediaId };
    await delegate.upsert({
      where: { [`${relation.parentField}_mediaId`]: identity },
      create: { ...identity, ...image },
      update: { position: image.position, altText: image.altText },
    });
  }
  return images;
}

async function approveInlineMedia(tx, images) {
  for (const image of images) await ensureMediaReady(tx, image.mediaId);
}

function cleanInput(resource, input, user) {
  const data = { ...input };
  const consentConfirmed = data.consentConfirmed;
  delete data.version;
  delete data.consentConfirmed;
  delete data.categoryIds;
  if (resource === 'stories' && consentConfirmed) {
    data.consentConfirmedAt = new Date();
    data.consentConfirmedById = user.id;
  }
  return data;
}

async function syncPublicationCategories(tx, publicationId, categoryIds) {
  if (categoryIds === undefined) return;
  const ids = [...new Set(categoryIds)];
  if (ids.length && await tx.category.count({ where: { id: { in: ids } } }) !== ids.length) {
    throw errors.unprocessable('Одна или несколько категорий не найдены.');
  }
  await tx.publicationCategory.deleteMany({ where: { publicationId } });
  if (ids.length) {
    try { await tx.publicationCategory.createMany({ data: ids.map(categoryId => ({ publicationId, categoryId })) }); }
    catch (error) {
      if (error.code === 'P2003') throw errors.conflict('CATEGORY_NOT_AVAILABLE', 'Категория была удалена или недоступна. Обновите список и повторите.');
      throw error;
    }
  }
}

async function ensureMediaReady(tx, mediaId) {
  if (!mediaId) return;
  const item = await tx.mediaAsset.findFirst({ where: { id: mediaId, deletedAt: null, status: 'READY', rightsConfirmed: true } });
  if (!item) throw errors.unprocessable('Обложка не готова к публикации.');
  await tx.mediaAsset.update({ where: { id: mediaId }, data: { visibility: 'PUBLIC', publicApprovedAt: new Date() } });
}

export async function adminList(resource, query) {
  const config = contentConfig[resource];
  const { page, pageSize, skip, take } = pagination(query);
  const where = adminWhere(resource, query);
  const delegate = delegateFor(resource);
  const [items, total] = await prisma.$transaction([
    delegate.findMany({ where, include: resource === 'publications' ? publicationInclude : coverInclude, skip, take, orderBy: config.orderBy }),
    delegate.count({ where }),
  ]);
  return { items, meta: metaFor(page, pageSize, total) };
}

export async function adminGet(resource, id) {
  const item = await delegateFor(resource).findFirst({ where: { id, deletedAt: null }, include: includeFor(resource) });
  if (!item) throw errors.notFound();
  return item;
}

export async function create(resource, input, user, requestId) {
  const config = contentConfig[resource];
  return prisma.$transaction(async tx => {
    const item = await tx[config.delegate].create({ data: { ...cleanInput(resource, input, user), createdById: user.id, updatedById: user.id }, include: resource === 'publications' ? publicationInclude : coverInclude });
    if (resource === 'publications') await syncPublicationCategories(tx, item.id, input.categoryIds || []);
    if (input.body || input.storyBody) await syncInlineMedia(tx, resource, item.id, input.body || input.storyBody);
    await writeAudit(tx, { actorId: user.id, action: 'CREATE', entityType: config.model, entityId: item.id, requestId });
    return resource === 'publications' ? tx.publication.findUnique({ where: { id: item.id }, include: publicationInclude }) : item;
  });
}

export async function update(resource, id, input, user, requestId) {
  const config = contentConfig[resource];
  const expectedVersion = input.version;
  if (!expectedVersion) throw errors.badRequest('Для изменения требуется version.');
  return prisma.$transaction(async tx => {
    if (Object.hasOwn(input, 'coverMediaId') && input.coverMediaId) {
      const current = await tx[config.delegate].findFirst({
        where: { id, version: expectedVersion, deletedAt: null },
        select: { status: true },
      });
      if (!current) throw errors.conflict('VERSION_CONFLICT', 'Запись была изменена другим пользователем.');
      if (current.status === 'PUBLISHED') await ensureMediaReady(tx, input.coverMediaId);
    }
    const result = await tx[config.delegate].updateMany({
      where: { id, version: expectedVersion, deletedAt: null },
      data: {
        ...cleanInput(resource, input, user),
        updatedById: user.id,
        version: { increment: 1 },
      },
    });
    if (!result.count) throw errors.conflict('VERSION_CONFLICT', 'Запись была изменена другим пользователем.');
    const item = await tx[config.delegate].findUnique({ where: { id }, include: includeFor(resource) });
    if (resource === 'publications') await syncPublicationCategories(tx, id, input.categoryIds);
    const body = input.body ?? input.storyBody;
    if (body !== undefined) {
      const images = await syncInlineMedia(tx, resource, id, body);
      if (item.status === 'PUBLISHED') await approveInlineMedia(tx, images);
    }
    await writeAudit(tx, { actorId: user.id, action: 'UPDATE', entityType: config.model, entityId: id, requestId });
    return resource === 'publications' ? tx.publication.findUnique({ where: { id }, include: publicationInclude }) : item;
  });
}

export async function setPublication(resource, id, version, publish, user, requestId) {
  const config = contentConfig[resource];
  return prisma.$transaction(async tx => {
    const item = await tx[config.delegate].findFirst({ where: { id, version, deletedAt: null }, include: resource === 'children' ? childInclude : undefined });
    if (!item) throw errors.conflict('VERSION_CONFLICT', 'Запись была изменена или не найдена.');
    if (publish) {
      await ensureMediaReady(tx, item.coverMediaId);
      const body = item.body ?? item.storyBody;
      const inline = inlineImages(body);
      for (const image of inline) {
        const media = await tx.mediaAsset.findFirst({ where: { id: image.mediaId, deletedAt: null, status: 'READY', kind: 'IMAGE', rightsConfirmed: true } });
        if (!media) throw errors.unprocessable('Inline-изображение не готово к публикации или не подтверждены права.');
      }
      await approveInlineMedia(tx, inline);
      if (resource === 'children') {
        if (user.role !== 'ADMIN') throw errors.forbidden();
        if (!childMediaArePublishable(item)) throw errors.unprocessable('Медиа карточки не готово к публикации или не подтверждены права.');
      }
      if (resource === 'stories' && !item.consentConfirmedAt) throw errors.unprocessable('Не подтверждено согласие для истории.');
    }
    const updated = await tx[config.delegate].update({ where: { id }, data: {
      status: publish ? 'PUBLISHED' : 'DRAFT',
      publishedAt: publish ? new Date() : null,
      publishedById: publish ? user.id : null,
      updatedById: user.id,
      version: { increment: 1 },
    } });
    await writeAudit(tx, { actorId: user.id, action: publish ? 'PUBLISH' : 'UNPUBLISH', entityType: config.model, entityId: id, requestId });
    return updated;
  });
}

export async function archive(resource, id, user, requestId) {
  const config = contentConfig[resource];
  await prisma.$transaction(async tx => {
    const result = await tx[config.delegate].updateMany({ where: { id, deletedAt: null }, data: { status: 'ARCHIVED', deletedAt: new Date(), updatedById: user.id, version: { increment: 1 } } });
    if (!result.count) throw errors.notFound();
    await writeAudit(tx, { actorId: user.id, action: 'ARCHIVE', entityType: config.model, entityId: id, requestId });
  });
}

export async function restore(resource, id, user, requestId) {
  const config = contentConfig[resource];
  return prisma.$transaction(async tx => {
    const result = await tx[config.delegate].updateMany({ where: { id, deletedAt: { not: null } }, data: { status: 'DRAFT', deletedAt: null, updatedById: user.id, version: { increment: 1 } } });
    if (!result.count) throw errors.notFound();
    await writeAudit(tx, { actorId: user.id, action: 'RESTORE', entityType: config.model, entityId: id, requestId });
    return tx[config.delegate].findUnique({ where: { id }, include: coverInclude });
  });
}

export async function publicList(resource, query) {
  const config = contentConfig[resource];
  const { page, pageSize, skip, take } = pagination(query, 50);
  const extra = {};
  if (query.kind && resource === 'publications') {
    if (!['NEWS', 'ARTICLE'].includes(query.kind)) throw errors.badRequest('Некорректный тип публикации.');
    extra.kind = query.kind;
  }
  if (query.kind && resource === 'projects') {
    if (!['PROJECT', 'PROGRAM', 'INITIATIVE'].includes(query.kind)) throw errors.badRequest('Некорректный тип проекта.');
    extra.kind = query.kind;
  }
  if (query.categoryId && resource === 'publications') extra.categories = { some: { categoryId: query.categoryId } };
  if (query.group && resource === 'pages') extra.group = query.group;
  const where = publicWhere(resource, extra);
  const delegate = delegateFor(resource);
  const [items, total] = await prisma.$transaction([
    delegate.findMany({ where, include: resource === 'publications' ? publicationInclude : coverInclude, skip, take, orderBy: resource === 'children' || resource === 'projects' || resource === 'pages' ? config.orderBy : { publishedAt: 'desc' } }),
    delegate.count({ where }),
  ]);
  return { items: items.map(item => publicContent(resource, item)), meta: metaFor(page, pageSize, total) };
}

export async function publicGet(resource, slug) {
  const item = await delegateFor(resource).findFirst({ where: publicWhere(resource, { slug }), include: includeFor(resource) });
  if (!item) throw errors.notFound();
  return publicContent(resource, item);
}

export async function publicPageGet(group, slug) {
  if (!['ABOUT', 'GIVE_HELP', 'GET_HELP', 'GENERAL'].includes(group)) throw errors.notFound();
  const item = await prisma.infoPage.findFirst({ where: publicWhere('pages', { group, slug }), include: coverInclude });
  if (!item) throw errors.notFound();
  return publicContent('pages', item);
}
