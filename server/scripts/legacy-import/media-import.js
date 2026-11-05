import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';

const formats = new Map([
  ['.jpg', { kind: 'IMAGE', mimeType: 'image/jpeg', extension: 'jpg' }],
  ['.jpeg', { kind: 'IMAGE', mimeType: 'image/jpeg', extension: 'jpeg' }],
  ['.png', { kind: 'IMAGE', mimeType: 'image/png', extension: 'png' }],
  ['.gif', { kind: 'IMAGE', mimeType: 'image/gif', extension: 'gif' }],
  ['.tif', { kind: 'IMAGE', mimeType: 'image/tiff', extension: 'tif' }],
  ['.pdf', { kind: 'DOCUMENT', mimeType: 'application/pdf', extension: 'pdf' }],
  ['.doc', { kind: 'DOCUMENT', mimeType: 'application/msword', extension: 'doc' }],
  ['.ogv', { kind: 'VIDEO', mimeType: 'video/ogg', extension: 'ogv' }],
]);

export function mediaFormat(filePath) {
  return formats.get(path.extname(String(filePath)).toLowerCase()) || null;
}

export function normalizeMediaPath(value) {
  let normalized = String(value || '').replaceAll('\\', '/').split(/[?#]/)[0].replace(/^\/+/, '');
  try { normalized = decodeURIComponent(normalized); } catch { /* keep encoded source path */ }
  return normalized.replace(/\/+/g, '/').toLowerCase();
}

export function mediaLookupKeys(value) {
  const normalized = normalizeMediaPath(value);
  return [...new Set([normalized, normalized.startsWith('media/') ? normalized.slice(6) : `media/${normalized}`])];
}

export function indexMediaId(map, sourcePath, mediaId) {
  for (const key of mediaLookupKeys(sourcePath)) map.set(key, mediaId);
}

export function resolveMediaIds(map, sourcePaths) {
  return [...new Set((sourcePaths || []).flatMap(sourcePath => mediaLookupKeys(sourcePath).map(key => map.get(key))).filter(Boolean))];
}

async function checksum(filePath) {
  const hash = createHash('sha256');
  await new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.once('end', resolve);
    stream.once('error', reject);
  });
  return hash.digest('hex');
}

function safeSourcePath(root, relativePath) {
  const target = path.resolve(root, relativePath);
  if (!target.startsWith(`${root}${path.sep}`)) throw new Error('Путь медиа выходит за пределы исходного каталога.');
  return target;
}

export async function importMediaFiles({ files, oldSiteRoot, actorId, prisma, mediaStorage, onProgress }) {
  const sourceRoot = path.resolve(oldSiteRoot);
  const mediaIds = new Map();
  const mediaKinds = new Map();
  const report = { created: 0, reused: 0, failed: [], bytesCopied: 0 };
  let processed = 0;
  for (const item of files) {
    try {
      const format = mediaFormat(item.path);
      if (!format) throw new Error('Расширение не поддерживается импортёром.');
      const sourcePath = safeSourcePath(sourceRoot, item.path);
      const details = await stat(sourcePath);
      if (!details.isFile() || details.size === 0) throw new Error('Файл отсутствует или пуст.');
      const digest = await checksum(sourcePath);
      const existing = await prisma.mediaAsset.findFirst({ where: { checksum: digest, deletedAt: null }, select: { id: true, kind: true } });
      if (existing) {
        indexMediaId(mediaIds, item.path, existing.id);
        mediaKinds.set(existing.id, existing.kind);
        report.reused += 1;
      } else {
        const storageKey = `${randomUUID()}.${format.extension}`;
        await mediaStorage.writeFromFile('PRIVATE', storageKey, sourcePath);
        try {
          const media = await prisma.mediaAsset.create({ data: {
            kind: format.kind,
            status: 'READY',
            visibility: 'PRIVATE',
            storageKey,
            originalName: path.basename(sourcePath).slice(0, 255),
            mimeType: format.mimeType,
            extension: format.extension,
            sizeBytes: BigInt(details.size),
            checksum: digest,
            rightsConfirmed: false,
            createdById: actorId,
          } });
          indexMediaId(mediaIds, item.path, media.id);
          mediaKinds.set(media.id, media.kind);
          report.created += 1;
          report.bytesCopied += details.size;
        } catch (error) {
          await mediaStorage.remove('PRIVATE', storageKey).catch(() => {});
          throw error;
        }
      }
    } catch (error) {
      report.failed.push({ path: item.path, reason: error.message });
    }
    processed += 1;
    if (processed % 100 === 0 || processed === files.length) onProgress?.({ processed, total: files.length, report: { created: report.created, reused: report.reused, failed: report.failed.length } });
  }
  return { mediaIds, mediaKinds, report };
}
