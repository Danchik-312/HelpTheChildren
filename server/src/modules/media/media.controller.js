import * as service from './media.service.js';
import { rm } from 'node:fs/promises';

export async function list(req, res) { const result = await service.list(req.query); res.json({ data: { items: result.items }, meta: result.meta }); }
export async function finalizeUploadRequest(req) {
  try {
    if (req.file?.path) await rm(req.file.path, { force: true });
  } finally {
    req.releaseUploadSlot?.();
  }
}

export async function withUploadLifecycle(req, operation) {
  try {
    return await operation();
  } finally {
    await finalizeUploadRequest(req);
  }
}

export async function upload(req, res) {
  const item = await withUploadLifecycle(req, () => service.upload(req.file, req.body, req.auth.user, req.id));
  if (!res.destroyed) res.status(201).json({ data: item });
}
export async function external(req, res) { res.status(201).json({ data: await service.createExternalVideo(req.body, req.auth.user, req.id) }); }
export async function update(req, res) { res.json({ data: await service.update(req.params.id, req.body, req.auth.user, req.id) }); }
export async function usages(req, res) { res.json({ data: await service.usages(req.params.id) }); }
export async function remove(req, res) { await service.remove(req.params.id, req.auth.user, req.id); res.status(204).end(); }
export async function stream(req, res) {
  const result = await service.publicStream(req.params.id);
  pipeMedia(res, result, 'private, no-store');
}
export async function adminStream(req, res) {
  const result = await service.adminStream(req.params.id);
  pipeMedia(res, result, 'private, no-store');
}

export function pipeMedia(res, result, cacheControl) {
  res.setHeader('Content-Type', result.item.mimeType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('Cache-Control', cacheControl);
  result.stream.on('error', error => res.destroy(error)).pipe(res);
}
