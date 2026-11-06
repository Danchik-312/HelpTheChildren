import { prisma } from '../../db/prisma.js';
import { errors } from '../../lib/api-error.js';
import { pagination, metaFor } from '../../lib/pagination.js';
import { writeAudit } from '../audit/audit.service.js';
import { contentConfig } from './content.config.js';
import { adminWhere, delegateFor, publicWhere } from './content.repository.js';
import { publicContent } from './content.presenter.js';
import { adminPublication, readPublicationBody, writePublicationBody } from './publication-body.js';
import { childMediaArePublishable } from './child-privacy.js';

const coverInclude = { coverMedia: true };
const publicationInclude = { ...coverInclude, categories: { include: { category: true } } };
const publicationDetailInclude = { ...publicationInclude, media: { include: { media: true } } };
const childMediaAccessFields = {
  status: true, deletedAt: true, publishedAt: true, coverMediaId: true, storyBody: true,
  media: { select: { mediaId: true } },
};
const publicPublicationInclude = {
  ...publicationInclude,
  media: { include: { media: { include: {
    childCovers: { select: childMediaAccessFields },
    childLinks: { select: { child: { select: childMediaAccessFields } } },
  } } } },
};
const childInclude = { coverMedia: true, media: { include: { media: true } } };

const includeFor = resource => resource === 'children' ? childInclude : resource === 'publications' ? publicationDetailInclude : coverInclude;
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

function contentImages(body, sidePhotos = []) {
  const images = inlineImages(body);
  const inlineIds = new Set(images.map(image => image.mediaId));
  for (const photo of sidePhotos) {
    if (!inlineIds.has(photo.mediaId)) images.push({ mediaId: photo.mediaId, altText: photo.altText, position: images.length });
  }
  return images;
}

export async function syncInlineMedia(tx, resource, parentId, body, sidePhotos) {
  const relation = inlineMediaRelations[resource];
  if (!relation) return [];
  const images = contentImages(body, sidePhotos);
  for (const image of images) {
    const media = await tx.mediaAsset.findFirst({ where: { id: image.mediaId, deletedAt: null, status: 'READY', kind: 'IMAGE' } });
    if (!media) throw errors.unprocessable('Изображение отсутствует или не готово к использованию.');
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
  delete data.sidePhotos;
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
  return { items: resource === 'publications' ? items.map(adminPublication) : items, meta: metaFor(page, pageSize, total) };
}

export async function adminGet(resource, id) {
  const item = await delegateFor(resource).findFirst({ where: { id, deletedAt: null }, include: includeFor(resource) });
  if (!item) throw errors.notFound();
  return resource === 'publications' ? adminPublication(item) : item;
}

export async function create(resource, input, user, requestId) {
  const config = contentConfig[resource];
  return prisma.$transaction(async tx => {
    const data = cleanInput(resource, input, user);
    if (resource === 'publications') data.body = writePublicationBody(input.body, input.sidePhotos ?? []);
    const item = await tx[config.delegate].create({ data: { ...data, createdById: user.id, updatedById: user.id }, include: resource === 'publications' ? publicationInclude : coverInclude });
    if (resource === 'publications') await syncPublicationCategories(tx, item.id, input.categoryIds || []);
    if (input.body || input.storyBody) await syncInlineMedia(tx, resource, item.id, input.body || input.storyBody, resource === 'publications' ? input.sidePhotos : undefined);
    await writeAudit(tx, { actorId: user.id, action: 'CREATE', entityType: config.model, entityId: item.id, requestId });
    return resource === 'publications' ? adminPublication(await tx.publication.findUnique({ where: { id: item.id }, include: publicationDetailInclude })) : item;
  });
}

export async function update(resource, id, input, user, requestId) {
  const config = contentConfig[resource];
  const expectedVersion = input.version;
  if (!expectedVersion) throw errors.badRequest('Для изменения требуется version.');
  return prisma.$transaction(async tx => {
    if (resource !== 'publications' && Object.hasOwn(input, 'coverMediaId') && input.coverMediaId) {
      const current = await tx[config.delegate].findFirst({
        where: { id, version: expectedVersion, deletedAt: null },
        select: { status: true },
      });
      if (!current) throw errors.conflict('VERSION_CONFLICT', 'Запись была изменена другим пользователем.');
      if (current.status === 'PUBLISHED') await ensureMediaReady(tx, input.coverMediaId);
    }
    const data = cleanInput(resource, input, user);
    let sidePhotos;
    let body = input.body ?? input.storyBody;
    if (resource === 'publications') {
      const current = await tx.publication.findFirst({ where: { id, version: expectedVersion, deletedAt: null }, select: { body: true } });
      if (!current) throw errors.conflict('VERSION_CONFLICT', 'Запись была изменена другим пользователем.');
      const previous = readPublicationBody(current.body);
      sidePhotos = input.sidePhotos ?? previous.sidePhotos;
      if (body !== undefined || input.sidePhotos !== undefined) {
        body ??= previous.body;
        data.body = writePublicationBody(body, sidePhotos);
      }
    }
    const result = await tx[config.delegate].updateMany({
      where: { id, version: expectedVersion, deletedAt: null },
      data: {
        ...data,
        updatedById: user.id,
        version: { increment: 1 },
      },
    });
    if (!result.count) throw errors.conflict('VERSION_CONFLICT', 'Запись была изменена другим пользователем.');
    const item = await tx[config.delegate].findUnique({ where: { id }, include: includeFor(resource) });
    if (resource === 'publications') {
      if (item.status === 'PUBLISHED' && input.coverMediaId) await ensureMediaReady(tx, input.coverMediaId);
      await syncPublicationCategories(tx, id, input.categoryIds);
    }
    if (resource === 'children' && item.status === 'PUBLISHED' && input.publicDisplayName === '') {
      throw errors.unprocessable('Укажите публичное имя ребёнка или снимите карточку с публикации.');
    }
    if (body !== undefined) {
      const images = await syncInlineMedia(tx, resource, id, body, sidePhotos);
      if (item.status === 'PUBLISHED') await approveInlineMedia(tx, images);
    }
    await writeAudit(tx, { actorId: user.id, action: 'UPDATE', entityType: config.model, entityId: id, requestId });
    return resource === 'publications' ? adminPublication(await tx.publication.findUnique({ where: { id }, include: publicationDetailInclude })) : item;
  });
}

export async function setPublication(resource, id, version, publish, user, requestId) {
  const config = contentConfig[resource];
  return prisma.$transaction(async tx => {
    const item = await tx[config.delegate].findFirst({ where: { id, version, deletedAt: null }, include: resource === 'children' ? childInclude : undefined });
    if (!item) throw errors.conflict('VERSION_CONFLICT', 'Запись была изменена или не найдена.');
    const data = {
      status: publish ? 'PUBLISHED' : 'DRAFT',
      publishedAt: publish ? new Date() : null,
      publishedById: publish ? user.id : null,
      updatedById: user.id,
      version: { increment: 1 },
    };
    if (resource === 'publications') {
      const result = await tx.publication.updateMany({ where: { id, version, deletedAt: null }, data });
      if (!result.count) throw errors.conflict('VERSION_CONFLICT', 'Запись была изменена другим пользователем.');
    }
    if (publish) {
      await ensureMediaReady(tx, item.coverMediaId);
      const { body, sidePhotos } = resource === 'publications'
        ? readPublicationBody(item.body)
        : { body: item.body ?? item.storyBody };
      const inline = contentImages(body, sidePhotos);
      for (const image of inline) {
        const media = await tx.mediaAsset.findFirst({ where: { id: image.mediaId, deletedAt: null, status: 'READY', kind: 'IMAGE', rightsConfirmed: true } });
        if (!media) throw errors.unprocessable('Изображение не готово к публикации или не подтверждены права.');
      }
      await approveInlineMedia(tx, inline);
      if (resource === 'children') {
        if (user.role !== 'ADMIN') throw errors.forbidden();
        if (!item.publicDisplayName?.trim()) throw errors.unprocessable('Укажите публичное имя ребёнка перед публикацией.');
        if (!childMediaArePublishable(item)) throw errors.unprocessable('Медиа карточки не готово к публикации или не подтверждены права.');
      }
      if (resource === 'stories' && !item.consentConfirmedAt) throw errors.unprocessable('Не подтверждено согласие для истории.');
    }
    if (resource === 'children') {
      const result = await tx.childProfile.updateMany({ where: { id, version, deletedAt: null }, data });
      if (!result.count) throw errors.conflict('VERSION_CONFLICT', 'Запись была изменена другим пользователем.');
    }
    const updated = resource === 'publications'
      ? await tx.publication.findUnique({ where: { id }, include: publicationDetailInclude })
      : resource === 'children'
        ? await tx.childProfile.findUnique({ where: { id } })
        : await tx[config.delegate].update({ where: { id }, data });
    await writeAudit(tx, { actorId: user.id, action: publish ? 'PUBLISH' : 'UNPUBLISH', entityType: config.model, entityId: id, requestId });
    return resource === 'publications' ? adminPublication(updated) : updated;
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
    const restored = await tx[config.delegate].findUnique({ where: { id }, include: resource === 'publications' ? publicationDetailInclude : coverInclude });
    return resource === 'publications' ? adminPublication(restored) : restored;
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
  const item = await delegateFor(resource).findFirst({ where: publicWhere(resource, { slug }), include: resource === 'publications' ? publicPublicationInclude : includeFor(resource) });
  if (!item) throw errors.notFound();
  return publicContent(resource, item);
}

export async function publicPageGet(group, slug) {
  if (!['ABOUT', 'GIVE_HELP', 'GET_HELP', 'GENERAL'].includes(group)) throw errors.notFound();
  const item = await prisma.infoPage.findFirst({ where: publicWhere('pages', { group, slug }), include: coverInclude });
  if (!item) throw errors.notFound();
  return publicContent('pages', item);
}
