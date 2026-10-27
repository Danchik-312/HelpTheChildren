import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { open, readFile, stat } from 'node:fs/promises';
import sharp from 'sharp';
import { prisma } from '../../db/prisma.js';
import { env } from '../../config/env.js';
import { errors } from '../../lib/api-error.js';
import { pagination, metaFor } from '../../lib/pagination.js';
import { mediaStorage } from '../../storage/local-media-storage.js';
import { writeAudit } from '../audit/audit.service.js';
import { isChildPubliclyVisible } from '../content/child-privacy.js';
import { normalizeExternalVideoUrl } from '../../lib/public-media-url.js';

const formats = {
  'image/jpeg': { extension: 'jpg', kind: 'IMAGE' },
  'image/png': { extension: 'png', kind: 'IMAGE' },
  'image/webp': { extension: 'webp', kind: 'IMAGE' },
  'video/mp4': { extension: 'mp4', kind: 'VIDEO' },
  'video/webm': { extension: 'webm', kind: 'VIDEO' },
};

const extensionOf = name => String(name || '').toLowerCase().split('.').pop();

function detectType(buffer) {
  if (buffer.length >= 12 && buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) return { mime: 'image/png' };
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { mime: 'image/jpeg' };
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return { mime: 'image/webp' };
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp') return { mime: 'video/mp4' };
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from('1a45dfa3', 'hex'))) return { mime: 'video/webm' };
  return null;
}

function validateVideoContainer(buffer, mime) {
  if (buffer.length < 32) throw errors.badRequest('Видео повреждено или слишком короткое.');
  if (mime === 'video/mp4') {
    const header = buffer.subarray(0, Math.min(buffer.length, 4096)).toString('latin1');
    if (!header.includes('ftyp') || !header.includes('mdat') && !header.includes('moov')) throw errors.badRequest('Структура MP4 повреждена.');
  }
  if (mime === 'video/webm') {
    const segment = Buffer.from('18538067', 'hex');
    if (buffer.indexOf(segment, 4) === -1) throw errors.badRequest('Структура WebM повреждена.');
  }
}

async function fileChecksum(filePath) {
  const hash = createHash('sha256');
  await new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.once('end', resolve);
    stream.once('error', reject);
  });
  return hash.digest('hex');
}

async function sampleFile(filePath, size) {
  const headLength = Math.min(size, 1024 * 1024);
  const tailLength = Math.min(Math.max(size - headLength, 0), 64 * 1024);
  const handle = await open(filePath, 'r');
  try {
    const head = Buffer.alloc(headLength);
    await handle.read(head, 0, headLength, 0);
    if (!tailLength) return head;
    const tail = Buffer.alloc(tailLength);
    await handle.read(tail, 0, tailLength, size - tailLength);
    return Buffer.concat([head, tail]);
  } finally {
    await handle.close();
  }
}

export async function inspectAndNormalize(file) {
  if (file?.path && !file.buffer) {
    const details = await stat(file.path);
    if (!details.isFile() || details.size === 0) throw errors.badRequest('Файл пуст или повреждён.');
    const sample = await sampleFile(file.path, details.size);
    const detected = detectType(sample);
    const allowed = detected && formats[detected.mime];
    if (!allowed || extensionOf(file.originalname) !== allowed.extension && !(allowed.extension === 'jpg' && extensionOf(file.originalname) === 'jpeg')) {
      throw errors.badRequest('Фактический тип или расширение файла не разрешены.');
    }
    const limit = allowed.kind === 'IMAGE' ? env.MAX_IMAGE_BYTES : env.MAX_VIDEO_BYTES;
    if (details.size > limit || Number(file.size || details.size) > limit) throw errors.badRequest('Файл превышает допустимый размер.');
    if (allowed.kind === 'IMAGE') return inspectAndNormalize({ ...file, path: undefined, buffer: await readFile(file.path), size: details.size });
    validateVideoContainer(sample, detected.mime);
    return { sourcePath: file.path, sizeBytes: details.size, ...allowed, mimeType: detected.mime };
  }
  if (!Buffer.isBuffer(file?.buffer) || file.buffer.length === 0) throw errors.badRequest('Файл пуст или повреждён.');
  const detected = detectType(file.buffer);
  const allowed = detected && formats[detected.mime];
  if (!allowed || extensionOf(file.originalname) !== allowed.extension && !(allowed.extension === 'jpg' && extensionOf(file.originalname) === 'jpeg')) {
    throw errors.badRequest('Фактический тип или расширение файла не разрешены.');
  }
  const limit = allowed.kind === 'IMAGE' ? env.MAX_IMAGE_BYTES : env.MAX_VIDEO_BYTES;
  if (file.buffer.length > limit || Number(file.size || file.buffer.length) > limit) throw errors.badRequest('Файл превышает допустимый размер.');
  if (allowed.kind === 'IMAGE') {
    const source = sharp(file.buffer, { limitInputPixels: 40_000_000, failOn: 'error' });
    const metadata = await source.metadata();
    const buffer = allowed.extension === 'jpg' ? await source.rotate().jpeg({ quality: 88 }).toBuffer()
      : allowed.extension === 'png' ? await source.rotate().png().toBuffer()
        : await source.rotate().webp({ quality: 88 }).toBuffer();
    return { buffer, ...allowed, mimeType: detected.mime, width: metadata.autoOrient.width, height: metadata.autoOrient.height };
  }
  validateVideoContainer(file.buffer, detected.mime);
  return { buffer: file.buffer, ...allowed, mimeType: detected.mime };
}

export async function upload(file, metadata, user, requestId) {
  if (!file) throw errors.badRequest('Файл не передан.');
  const normalized = await inspectAndNormalize(file);
  const key = `${randomUUID()}.${normalized.extension}`;
  try {
    if (normalized.sourcePath) await mediaStorage.writeFromFile('PRIVATE', key, normalized.sourcePath);
    else await mediaStorage.write('PRIVATE', key, normalized.buffer);
    const sizeBytes = normalized.sizeBytes ?? normalized.buffer.length;
    const checksum = normalized.sourcePath
      ? await fileChecksum(normalized.sourcePath)
      : createHash('sha256').update(normalized.buffer).digest('hex');
    return await prisma.$transaction(async tx => {
      const item = await tx.mediaAsset.create({ data: {
        kind: normalized.kind, status: 'READY', visibility: 'PRIVATE', storageKey: key,
        originalName: String(file.originalname).slice(0, 255), mimeType: normalized.mimeType,
        extension: normalized.extension, sizeBytes,
        checksum,
        width: normalized.width, height: normalized.height,
        defaultAlt: metadata.defaultAlt, caption: metadata.caption, credit: metadata.credit,
        rightsConfirmed: metadata.rightsConfirmed || false, createdById: user.id,
      } });
      await writeAudit(tx, { actorId: user.id, action: 'UPLOAD', entityType: 'MediaAsset', entityId: item.id, requestId });
      return item;
    });
  } catch (error) {
    await mediaStorage.remove('PRIVATE', key).catch(() => {});
    throw error;
  }
}

export async function createExternalVideo(input, user, requestId) {
  const url = normalizeExternalVideoUrl(input.url);
  if (!url) throw errors.badRequest('Источник видео не разрешён.');
  return prisma.$transaction(async tx => {
    const item = await tx.mediaAsset.create({ data: { kind: 'EXTERNAL_VIDEO', status: 'READY', visibility: 'PRIVATE', externalUrl: url.toString(), mimeType: 'text/uri-list', defaultAlt: input.defaultAlt, rightsConfirmed: input.rightsConfirmed, createdById: user.id } });
    await writeAudit(tx, { actorId: user.id, action: 'CREATE', entityType: 'MediaAsset', entityId: item.id, requestId });
    return item;
  });
}

export async function list(query) {
  const { page, pageSize, skip, take } = pagination(query);
  const where = { deletedAt: null, ...(query.kind && { kind: query.kind }), ...(query.visibility && { visibility: query.visibility }) };
  const [items, total] = await prisma.$transaction([prisma.mediaAsset.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }), prisma.mediaAsset.count({ where })]);
  return { items, meta: metaFor(page, pageSize, total) };
}

export async function update(id, input, user, requestId) {
  return prisma.$transaction(async tx => {
    // Rights withdrawal is a visibility revocation, not metadata-only editing.
    const data = input.rightsConfirmed === false
      ? { ...input, visibility: 'PRIVATE', publicApprovedAt: null }
      : input;
    const result = await tx.mediaAsset.updateMany({ where: { id, deletedAt: null }, data });
    if (!result.count) throw errors.notFound();
    await writeAudit(tx, { actorId: user.id, action: 'UPDATE', entityType: 'MediaAsset', entityId: id, requestId });
    return tx.mediaAsset.findUnique({ where: { id } });
  });
}

export async function usages(id) {
  const item = await prisma.mediaAsset.findUnique({ where: { id }, include: {
    _count: { select: { publicationCovers: true, storyCovers: true, childCovers: true, projectCovers: true, pageCovers: true, heroMedia: true, heroPosters: true, publicationLinks: true, storyLinks: true, childLinks: true, projectLinks: true, pageInlineMedia: true } },
  } });
  if (!item) throw errors.notFound();
  return item._count;
}

export async function remove(id, user, requestId) {
  const counts = await usages(id);
  if (Object.values(counts).some(Boolean)) throw errors.conflict('MEDIA_IN_USE', 'Файл используется и не может быть удалён.');
  const item = await prisma.$transaction(async tx => {
    const media = await tx.mediaAsset.findFirst({ where: { id, deletedAt: null } });
    if (!media) throw errors.notFound();
    await tx.mediaAsset.update({ where: { id }, data: { deletedAt: new Date(), visibility: 'PRIVATE' } });
    await writeAudit(tx, { actorId: user.id, action: 'DELETE', entityType: 'MediaAsset', entityId: id, requestId });
    return media;
  });
  if (item.storageKey) await mediaStorage.remove('PRIVATE', item.storageKey);
}

export function publicMediaIsEntitled(item, now = new Date()) {
  const bodyReferencesMedia = body => {
    let found = false;
    const visit = node => {
      if (found || !node || typeof node !== 'object') return;
      if (node.type === 'image' && node.attrs?.mediaId === item.id) { found = true; return; }
      if (Array.isArray(node)) node.forEach(visit);
      else if (node.content) visit(node.content);
    };
    visit(body);
    return found;
  };
  const linkedChildren = [...(item.childCovers || []), ...(item.childLinks || []).map(link => link.child)];
  if (linkedChildren.length) {
    return linkedChildren.every(child => {
      const childLink = child.media?.find(link => link.mediaId === item.id);
      const activeCover = child.coverMediaId === item.id;
      const activeInline = Boolean(childLink) && bodyReferencesMedia(child.storyBody);
      return isChildPubliclyVisible(child, now) && (activeCover || activeInline);
    });
  }
  return [
    ...(item.publicationCovers || []),
    ...(item.storyCovers || []),
    ...(item.projectCovers || []),
    ...(item.pageCovers || []),
    ...(item.heroMedia || []),
    ...(item.heroPosters || []),
    ...(item.publicationLinks || []).map(link => link.publication),
    ...(item.storyLinks || []).map(link => link.story),
    ...(item.projectLinks || []).map(link => link.project),
    ...(item.pageInlineMedia || []).map(link => link.page),
  ].some(parent => parent.status === 'PUBLISHED' && parent.deletedAt === null && parent.publishedAt && parent.publishedAt <= now);
}

export async function publicStream(id) {
  const item = await prisma.mediaAsset.findFirst({
    where: { id, status: 'READY', visibility: 'PUBLIC', rightsConfirmed: true, deletedAt: null, storageKey: { not: null } },
    include: {
      publicationCovers: { select: { status: true, publishedAt: true, deletedAt: true } },
      storyCovers: { select: { status: true, publishedAt: true, deletedAt: true } },
      projectCovers: { select: { status: true, publishedAt: true, deletedAt: true } },
      pageCovers: { select: { status: true, publishedAt: true, deletedAt: true } },
      heroMedia: { select: { status: true, publishedAt: true, deletedAt: true } },
      heroPosters: { select: { status: true, publishedAt: true, deletedAt: true } },
      publicationLinks: { select: { publication: { select: { status: true, publishedAt: true, deletedAt: true } } } },
      storyLinks: { select: { story: { select: { status: true, publishedAt: true, deletedAt: true } } } },
      projectLinks: { select: { project: { select: { status: true, publishedAt: true, deletedAt: true } } } },
      pageInlineMedia: { select: { page: { select: { status: true, publishedAt: true, deletedAt: true } } } },
      childCovers: { include: { media: { select: { mediaId: true } } } },
      childLinks: { include: { child: { include: { media: { select: { mediaId: true } } } } } },
    },
  });
  if (!item) throw errors.notFound();
  const sensitive = item.childCovers.length > 0 || item.childLinks.length > 0;
  if (!publicMediaIsEntitled(item)) throw errors.notFound();
  return { item, sensitive, stream: mediaStorage.read('PRIVATE', item.storageKey) };
}

export async function adminStream(id) {
  const item = await prisma.mediaAsset.findFirst({
    where: { id, status: 'READY', deletedAt: null, storageKey: { not: null } },
  });
  if (!item) throw errors.notFound();
  return { item, stream: mediaStorage.read('PRIVATE', item.storageKey) };
}
