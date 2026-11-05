import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '../src/db/prisma.js';
import { mediaStorage } from '../src/storage/local-media-storage.js';
import { normalizeExternalVideoUrl } from '../src/lib/public-media-url.js';
import { buildExtendedImportPlan, buildImportPlan, parseMigrationData, summarizeExtendedPlan, summarizePlan } from './legacy-import/legacy-import.js';
import { importMediaFiles, mediaLookupKeys, resolveMediaIds } from './legacy-import/media-import.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultSource = path.resolve(here, '..', '..', '..', 'Данные deti.kg');
const args = new Map(process.argv.slice(2).map(argument => {
  const [key, ...rest] = argument.split('=');
  return [key, rest.length ? rest.join('=') : true];
}));
const apply = args.has('--apply');
const checkDatabase = args.has('--check-db');
const extended = args.get('--scope') === 'all';
const replaceManual = args.has('--replace-manual');
const sourceRoot = path.resolve(String(args.get('--source') || defaultSource));
const actorIdArgument = args.get('--actor-id');

if (replaceManual && (!apply || !extended)) {
  throw new Error('--replace-manual разрешён только вместе с --scope=all --apply.');
}

async function loadPlan() {
  const [sql, dataSource] = await Promise.all([
    fs.readFile(path.join(sourceRoot, 'user58681_deti.sql'), 'utf8'),
    fs.readFile(path.join(sourceRoot, 'migration-map-site', 'data.js'), 'utf8'),
  ]);
  const migrationData = parseMigrationData(dataSource);
  return extended ? buildExtendedImportPlan({ sql, migrationData }) : buildImportPlan({ sql, migrationData });
}

async function resolveActor() {
  if (actorIdArgument) {
    const actor = await prisma.user.findFirst({ where: { id: String(actorIdArgument), status: 'ACTIVE' }, select: { id: true } });
    if (!actor) throw new Error('Активный пользователь с указанным --actor-id не найден.');
    return actor.id;
  }
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE' }, select: { id: true }, take: 2 });
  if (admins.length !== 1) throw new Error('Для импорта нужен ровно один активный ADMIN или явный --actor-id.');
  return admins[0].id;
}

async function inspectDatabase(plan) {
  const [organization, categories, pages, publications, projects, homeBlocks, children, stories, contacts, hero, media] = await Promise.all([
    plan.organization ? prisma.organizationProfile.count({ where: { id: 'main' } }) : 0,
    plan.categories.length ? prisma.category.count({ where: { slug: { in: plan.categories.map(item => item.slug) } } }) : 0,
    plan.pages.length ? prisma.infoPage.count({ where: { OR: plan.pages.map(item => ({ group: item.group, slug: item.slug })) } }) : 0,
    plan.publications.length ? prisma.publication.count({ where: { slug: { in: plan.publications.map(item => item.slug) } } }) : 0,
    plan.projects.length ? prisma.project.count({ where: { slug: { in: plan.projects.map(item => item.slug) } } }) : 0,
    plan.homeBlocks.length ? prisma.homeBlock.count({ where: { key: { in: plan.homeBlocks.map(item => item.key) } } }) : 0,
    plan.children?.length ? prisma.childProfile.count({ where: { slug: { in: plan.children.map(item => item.slug) } } }) : 0,
    plan.stories?.length ? prisma.story.count({ where: { slug: { in: plan.stories.map(item => item.slug) } } }) : 0,
    prisma.contactEntry.count(),
    prisma.heroSlide.count(),
    prisma.mediaAsset.count({ where: { deletedAt: null } }),
  ]);
  const existing = { organization, categories, pages, publications, projects, homeBlocks, children, stories, contacts, hero, media };
  return {
    existing,
    wouldCreate: {
      organization: (plan.organization ? 1 : 0) - organization,
      categories: plan.categories.length - categories,
      pages: plan.pages.length - pages,
      publications: plan.publications.length - publications,
      projects: plan.projects.length - projects,
      homeBlocks: plan.homeBlocks.length - homeBlocks,
      ...(plan.children && { children: plan.children.length - children }),
      ...(plan.stories && { stories: plan.stories.length - stories }),
      ...(plan.contacts && { contacts: plan.contacts.length }),
      ...(plan.hero && { hero: plan.hero.length }),
    },
  };
}

function databaseData(item) {
  const data = { ...item };
  delete data.legacyId;
  delete data.sourceMediaPaths;
  delete data.categoryName;
  delete data.externalUrl;
  delete data.posterPath;
  return data;
}

function resolvedMedia(item, mediaContext) {
  if (!mediaContext || !item.sourceMediaPaths?.length) return { ids: [], coverId: null };
  const ids = resolveMediaIds(mediaContext.mediaIds, item.sourceMediaPaths);
  return { ids, coverId: ids.find(id => mediaContext.mediaKinds.get(id) === 'IMAGE') || null };
}

function isImportedRecord(existing, item) {
  if (!existing || !item.createdAt || !['DRAFT', 'ARCHIVED'].includes(existing.status)) return false;
  return Math.abs(new Date(existing.createdAt).getTime() - new Date(item.createdAt).getTime()) < 1_000;
}

async function cleanupManualRecords(plan, actorId) {
  const firstImport = await prisma.auditLog.findFirst({
    where: { action: 'MIGRATE', entityType: 'LegacyImport' },
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true },
  });
  if (!firstImport) throw new Error('Не найдена контрольная запись первого импорта; очистка отменена.');

  const importedSlugs = {
    publications: plan.publications.map(item => item.slug),
    projects: plan.projects.map(item => item.slug),
    children: plan.children.map(item => item.slug),
    stories: plan.stories.map(item => item.slug),
    categories: plan.categories.map(item => item.slug),
  };
  const importedPages = plan.pages.map(item => ({ group: item.group, slug: item.slug }));
  const createdBeforeImport = { lt: firstImport.createdAt };

  const candidates = await prisma.$transaction(async tx => ({
    organization: await tx.organizationProfile.findMany({ where: { id: 'main' }, select: { id: true } }),
    publications: await tx.publication.findMany({
      where: { createdAt: createdBeforeImport, slug: { notIn: importedSlugs.publications } },
      select: { id: true },
    }),
    projects: await tx.project.findMany({
      where: { createdAt: createdBeforeImport, slug: { notIn: importedSlugs.projects } },
      select: { id: true },
    }),
    pages: await tx.infoPage.findMany({
      where: { createdAt: createdBeforeImport, NOT: importedPages },
      select: { id: true },
    }),
    children: await tx.childProfile.findMany({
      where: { createdAt: createdBeforeImport, slug: { notIn: importedSlugs.children } },
      select: { id: true },
    }),
    stories: await tx.story.findMany({
      where: { createdAt: createdBeforeImport, slug: { notIn: importedSlugs.stories } },
      select: { id: true },
    }),
    categories: await tx.category.findMany({
      where: { createdAt: createdBeforeImport, slug: { notIn: importedSlugs.categories } },
      select: { id: true },
    }),
    homeBlocks: await tx.homeBlock.findMany({
      where: { key: { in: plan.homeBlocks.map(item => item.key) } },
      select: { id: true },
    }),
    hero: await tx.heroSlide.findMany({
      where: { createdAt: createdBeforeImport },
      select: { id: true },
    }),
    media: await tx.mediaAsset.findMany({
      where: { createdAt: createdBeforeImport },
      select: { id: true, storageKey: true, visibility: true },
    }),
  }));

  const limits = {
    organization: 1,
    publications: 5,
    projects: 0,
    pages: 0,
    children: 7,
    stories: 0,
    categories: 1,
    homeBlocks: 5,
    hero: 2,
    media: 1,
  };
  for (const [type, limit] of Object.entries(limits)) {
    if (candidates[type].length > limit) {
      throw new Error(`Очистка отменена: найдено слишком много записей ${type} (${candidates[type].length} > ${limit}).`);
    }
  }

  const ids = type => candidates[type].map(item => item.id);
  const cleanup = await prisma.$transaction(async tx => {
    const deleted = {};
    const remove = async (key, delegate, where) => {
      const result = await tx[delegate].deleteMany({ where });
      deleted[key] = result.count;
    };

    await remove('hero', 'heroSlide', { id: { in: ids('hero') } });
    await remove('publications', 'publication', { id: { in: ids('publications') } });
    await remove('projects', 'project', { id: { in: ids('projects') } });
    await remove('pages', 'infoPage', { id: { in: ids('pages') } });
    await remove('children', 'childProfile', { id: { in: ids('children') } });
    await remove('stories', 'story', { id: { in: ids('stories') } });
    await remove('categories', 'category', { id: { in: ids('categories') } });
    await remove('homeBlocks', 'homeBlock', { id: { in: ids('homeBlocks') } });
    await remove('organization', 'organizationProfile', { id: { in: ids('organization') } });

    const removableMedia = [];
    for (const item of candidates.media) {
      const linked = await tx.mediaAsset.findUnique({
        where: { id: item.id },
        select: { _count: true },
      });
      const referenceCount = linked ? Object.values(linked._count).reduce((sum, count) => sum + count, 0) : 0;
      if (referenceCount === 0) removableMedia.push(item);
    }
    await remove('media', 'mediaAsset', { id: { in: removableMedia.map(item => item.id) } });
    deleted.mediaSkippedWithReferences = candidates.media.length - removableMedia.length;

    await tx.auditLog.create({
      data: {
        actorId,
        action: 'DELETE',
        entityType: 'LegacyManualCleanup',
        summary: JSON.stringify(deleted),
      },
    });
    return { deleted, removableMedia };
  }, { timeout: 300_000 });

  const storage = { removed: 0, failed: [] };
  for (const item of cleanup.removableMedia) {
    if (!item.storageKey) continue;
    try {
      await mediaStorage.remove(item.visibility, item.storageKey);
      storage.removed += 1;
    } catch (error) {
      storage.failed.push({ id: item.id, storageKey: item.storageKey, reason: error.message });
    }
  }
  return { cutoff: firstImport.createdAt.toISOString(), deleted: cleanup.deleted, storage };
}

async function applyPlan(plan, options = {}) {
  const actorId = options.actorId || await resolveActor();
  const mediaContext = options.mediaContext;
  return prisma.$transaction(async tx => {
    const result = { created: {}, skipped: {}, linked: {}, conflicts: {} };
    const record = (bucket, key) => { bucket[key] = (bucket[key] || 0) + 1; };
    const categoryIds = new Map();

    for (const item of plan.categories) {
      const existing = await tx.category.findUnique({ where: { slug: item.slug }, select: { id: true, name: true } });
      if (existing) { categoryIds.set(item.name, existing.id); record(result.skipped, 'categories'); continue; }
      const created = await tx.category.create({ data: { slug: item.slug, name: item.name } });
      categoryIds.set(created.name, created.id);
      record(result.created, 'categories');
    }

    if (plan.organization) {
      const existing = await tx.organizationProfile.findUnique({ where: { id: 'main' }, select: { id: true } });
      if (existing) record(result.skipped, 'organization');
      else {
        const data = databaseData(plan.organization);
        await tx.organizationProfile.create({ data: { id: 'main', ...data, updatedById: actorId } });
        record(result.created, 'organization');
      }
    }

    for (const item of plan.pages) {
      const existing = await tx.infoPage.findUnique({ where: { group_slug: { group: item.group, slug: item.slug } }, select: { id: true, status: true, createdAt: true, coverMediaId: true } });
      let entity = existing;
      let owned = isImportedRecord(existing, item);
      if (existing) record(result.skipped, 'pages');
      else {
        const data = databaseData(item);
        entity = await tx.infoPage.create({ data: { ...data, status: item.status || 'DRAFT', createdById: actorId, updatedById: actorId }, select: { id: true, status: true, createdAt: true, coverMediaId: true } });
        owned = true;
        record(result.created, 'pages');
      }
      const media = resolvedMedia(item, mediaContext);
      if (owned && media.ids.length) {
        if (!entity.coverMediaId && media.coverId) { await tx.infoPage.update({ where: { id: entity.id }, data: { coverMediaId: media.coverId } }); record(result.linked, 'pageCovers'); }
        const linked = await tx.infoPageInlineMedia.createMany({ data: media.ids.map((mediaId, position) => ({ pageId: entity.id, mediaId, position })), skipDuplicates: true });
        result.linked.pageMedia = (result.linked.pageMedia || 0) + linked.count;
      } else if (existing && media.ids.length && !owned) record(result.conflicts, 'pages');
    }

    for (const item of plan.projects) {
      const existing = await tx.project.findUnique({ where: { slug: item.slug }, select: { id: true, status: true, createdAt: true, coverMediaId: true } });
      let entity = existing;
      let owned = isImportedRecord(existing, item);
      if (existing) record(result.skipped, 'projects');
      else {
        const data = databaseData(item);
        entity = await tx.project.create({ data: { ...data, status: item.status || 'DRAFT', createdById: actorId, updatedById: actorId }, select: { id: true, status: true, createdAt: true, coverMediaId: true } });
        owned = true;
        record(result.created, 'projects');
      }
      const media = resolvedMedia(item, mediaContext);
      if (owned && media.ids.length) {
        if (!entity.coverMediaId && media.coverId) { await tx.project.update({ where: { id: entity.id }, data: { coverMediaId: media.coverId } }); record(result.linked, 'projectCovers'); }
        const linked = await tx.projectMedia.createMany({ data: media.ids.map((mediaId, position) => ({ projectId: entity.id, mediaId, position })), skipDuplicates: true });
        result.linked.projectMedia = (result.linked.projectMedia || 0) + linked.count;
      } else if (existing && media.ids.length && !owned) record(result.conflicts, 'projects');
    }

    for (const item of plan.publications) {
      const existing = await tx.publication.findUnique({ where: { slug: item.slug }, select: { id: true, status: true, createdAt: true, coverMediaId: true } });
      let entity = existing;
      let owned = isImportedRecord(existing, item);
      if (existing) record(result.skipped, 'publications');
      else {
        const data = databaseData(item);
        const categoryId = categoryIds.get(item.categoryName);
        entity = await tx.publication.create({ data: {
          ...data,
          status: item.status || 'DRAFT',
          createdById: actorId,
          updatedById: actorId,
          ...(categoryId && { categories: { create: [{ categoryId }] } }),
        }, select: { id: true, status: true, createdAt: true, coverMediaId: true } });
        owned = true;
        record(result.created, 'publications');
      }
      const media = resolvedMedia(item, mediaContext);
      if (owned && media.ids.length) {
        if (!entity.coverMediaId && media.coverId) { await tx.publication.update({ where: { id: entity.id }, data: { coverMediaId: media.coverId } }); record(result.linked, 'publicationCovers'); }
        const linked = await tx.publicationMedia.createMany({ data: media.ids.map((mediaId, position) => ({ publicationId: entity.id, mediaId, position })), skipDuplicates: true });
        result.linked.publicationMedia = (result.linked.publicationMedia || 0) + linked.count;
      } else if (existing && media.ids.length && !owned) record(result.conflicts, 'publications');
    }

    for (const item of plan.homeBlocks) {
      const existing = await tx.homeBlock.findUnique({ where: { key: item.key }, select: { id: true } });
      if (existing) { record(result.skipped, 'homeBlocks'); continue; }
      const data = databaseData(item);
      await tx.homeBlock.create({ data: { ...data, updatedById: actorId } });
      record(result.created, 'homeBlocks');
    }

    for (const item of plan.children || []) {
      const existing = await tx.childProfile.findUnique({ where: { slug: item.slug }, select: { id: true } });
      if (existing) { record(result.skipped, 'children'); continue; }
      const data = databaseData(item);
      const media = resolvedMedia(item, mediaContext);
      const child = await tx.childProfile.create({ data: { ...data, privacyReviewStatus: 'PENDING', coverMediaId: media.coverId, createdById: actorId, updatedById: actorId }, select: { id: true } });
      if (media.ids.length) {
        const linked = await tx.childMedia.createMany({ data: media.ids.map((mediaId, position) => ({ childId: child.id, mediaId, position, consentApproved: false })), skipDuplicates: true });
        result.linked.childMedia = (result.linked.childMedia || 0) + linked.count;
        if (media.coverId) record(result.linked, 'childCovers');
      }
      record(result.created, 'children');
    }

    for (const item of plan.stories || []) {
      const existing = await tx.story.findUnique({ where: { slug: item.slug }, select: { id: true } });
      if (existing) { record(result.skipped, 'stories'); continue; }
      const data = databaseData(item);
      const media = resolvedMedia(item, mediaContext);
      const story = await tx.story.create({ data: { ...data, coverMediaId: media.coverId, createdById: actorId, updatedById: actorId }, select: { id: true } });
      if (media.ids.length) {
        const linked = await tx.storyMedia.createMany({ data: media.ids.map((mediaId, position) => ({ storyId: story.id, mediaId, position })), skipDuplicates: true });
        result.linked.storyMedia = (result.linked.storyMedia || 0) + linked.count;
        if (media.coverId) record(result.linked, 'storyCovers');
      }
      record(result.created, 'stories');
    }

    for (const item of plan.contacts || []) {
      const existing = await tx.contactEntry.findFirst({ where: { type: item.type, value: item.value }, select: { id: true } });
      if (existing) { record(result.skipped, 'contacts'); continue; }
      await tx.contactEntry.create({ data: { ...databaseData(item), updatedById: actorId } });
      record(result.created, 'contacts');
    }

    for (const item of plan.hero || []) {
      const normalizedUrl = normalizeExternalVideoUrl(item.externalUrl);
      if (!normalizedUrl) { record(result.conflicts, 'heroInvalidUrl'); continue; }
      let heroMedia = await tx.mediaAsset.findFirst({ where: { kind: 'EXTERNAL_VIDEO', externalUrl: normalizedUrl.toString(), deletedAt: null }, select: { id: true } });
      if (!heroMedia) {
        heroMedia = await tx.mediaAsset.create({ data: { kind: 'EXTERNAL_VIDEO', status: 'READY', visibility: 'PRIVATE', externalUrl: normalizedUrl.toString(), mimeType: 'text/uri-list', defaultAlt: item.altText, rightsConfirmed: false, createdById: actorId }, select: { id: true } });
        record(result.created, 'externalVideoMedia');
      }
      const posterMediaId = item.posterPath ? mediaLookupKeys(item.posterPath).map(key => mediaContext?.mediaIds.get(key)).find(Boolean) || null : null;
      const existing = await tx.heroSlide.findFirst({ where: { title: item.title, subtitle: item.subtitle, status: 'DRAFT', deletedAt: null }, select: { id: true } });
      if (existing) { record(result.skipped, 'hero'); continue; }
      await tx.heroSlide.create({ data: { title: item.title, subtitle: item.subtitle, mediaId: heroMedia.id, posterMediaId, altText: item.altText, isDecorative: item.isDecorative, position: item.position, status: 'DRAFT', createdById: actorId, updatedById: actorId } });
      record(result.created, 'hero');
    }

    const auditSummary = JSON.stringify({ created: result.created, skipped: result.skipped, linked: result.linked, conflicts: result.conflicts });
    await tx.auditLog.create({ data: { actorId, action: 'MIGRATE', entityType: extended ? 'LegacyFullImport' : 'LegacyImport', summary: auditSummary } });
    return result;
  }, { timeout: 300_000 });
}

try {
  const plan = await loadPlan();
  const database = checkDatabase && !apply ? await inspectDatabase(plan) : undefined;
  const planSummary = extended ? summarizeExtendedPlan(plan) : summarizePlan(plan);
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', scope: extended ? 'all' : 'safe', sourceRoot, plan: planSummary, ...(database && { database }) }, null, 2));
  if (!apply) console.log('Dry-run завершён: база данных не изменялась.');
  else if (!extended) console.log(JSON.stringify({ result: await applyPlan(plan) }, null, 2));
  else {
    const actorId = await resolveActor();
    const cleanupResult = replaceManual ? await cleanupManualRecords(plan, actorId) : undefined;
    if (cleanupResult) console.log(JSON.stringify({ cleanup: cleanupResult }, null, 2));
    const mediaResult = await importMediaFiles({
      files: plan.media.files,
      oldSiteRoot: path.join(sourceRoot, 'deti.kg'),
      actorId,
      prisma,
      mediaStorage,
      onProgress: progress => console.log(`Медиа: ${progress.processed}/${progress.total}; создано ${progress.report.created}; повторно использовано ${progress.report.reused}; ошибок ${progress.report.failed}`),
    });
    const contentResult = await applyPlan(plan, { actorId, mediaContext: mediaResult });
    const report = {
      generatedAt: new Date().toISOString(),
      sourceRoot,
      plan: planSummary,
      ...(cleanupResult && { cleanup: cleanupResult }),
      media: mediaResult.report,
      content: contentResult,
      unresolved: {
        missingRefs: plan.media.missingRefs,
        dangerousFiles: plan.media.dangerous,
        unassigned: plan.unassigned.map(item => ({ uid: item.uid, oldId: item.oldId, title: item.title, reason: item.reason, suggestions: item.suggestions })),
        skipped: plan.skipped,
      },
    };
    const reportPath = path.join(process.cwd(), 'storage', 'private', 'legacy-import-report.json');
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify({ result: { media: mediaResult.report, content: contentResult }, reportPath }, null, 2));
  }
} catch (error) {
  console.error(`Импорт не выполнен: ${error.message}`);
  process.exitCode = 1;
} finally {
  await prisma['$disconnect']();
}
