import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import multer from 'multer';

process.env.DATABASE_URL ||= 'postgresql://unused:unused@127.0.0.1:1/unused';
const { createExternalVideo, inspectAndNormalize, upload: uploadMedia } = await import('../src/modules/media/media.service.js');
const { mediaStorage } = await import('../src/storage/local-media-storage.js');
const { prisma } = await import('../src/db/prisma.js');
const { createUploadConcurrencyLimit } = await import('../src/modules/media/media.routes.js');
const { withUploadLifecycle } = await import('../src/modules/media/media.controller.js');
const { jsonReplacer } = await import('../src/lib/json.js');
const { errorHandler } = await import('../src/middleware/error-handler.js');

test('Prisma BigInt values are serialized as decimal strings', () => {
  assert.equal(JSON.stringify({ sizeBytes: 1234567890123456789n }, jsonReplacer), '{"sizeBytes":"1234567890123456789"}');
});

test('upload validation rejects executable or unknown content', async () => {
  await assert.rejects(
    inspectAndNormalize({ buffer: Buffer.from('MZ fake executable'), originalname: 'photo.jpg', size: 18 }),
    error => error.code === 'VALIDATION_ERROR',
  );
});

test('upload validation rejects extension mismatch', async () => {
  const pngHeader = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
  await assert.rejects(
    inspectAndNormalize({ buffer: pngHeader, originalname: 'photo.jpg', size: pngHeader.length }),
    error => error.code === 'VALIDATION_ERROR',
  );
});

test('upload validation accepts decoded JPEG, PNG and WebP images', async () => {
  const source = sharp({ create: { width: 2, height: 2, channels: 3, background: '#ffffff' } });
  const cases = [
    ['photo.jpg', await source.clone().jpeg().toBuffer(), 'image/jpeg'],
    ['photo.png', await source.clone().png().toBuffer(), 'image/png'],
    ['photo.webp', await source.clone().webp().toBuffer(), 'image/webp'],
  ];
  for (const [originalname, buffer, mime] of cases) {
    const result = await inspectAndNormalize({ buffer, originalname, size: buffer.length });
    assert.equal(result.mimeType, mime);
    assert.ok(result.width > 0 && result.height > 0);
  }
});

test('upload validation accepts structurally identified MP4 and WebM containers', async () => {
  const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom0000isom'), Buffer.from('mdat'), Buffer.alloc(32)]);
  const webm = Buffer.concat([Buffer.from('1a45dfa3', 'hex'), Buffer.alloc(8), Buffer.from('18538067', 'hex'), Buffer.alloc(32)]);
  assert.equal((await inspectAndNormalize({ buffer: mp4, originalname: 'clip.mp4', size: mp4.length })).mimeType, 'video/mp4');
  assert.equal((await inspectAndNormalize({ buffer: webm, originalname: 'clip.webm', size: webm.length })).mimeType, 'video/webm');
});

test('disk-backed video validation does not load the complete upload into a buffer', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'detki-media-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, 'upload.tmp');
  const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom0000isom'), Buffer.from('mdat'), Buffer.alloc(1024)]);
  await writeFile(filePath, mp4);
  const result = await inspectAndNormalize({ path: filePath, originalname: 'clip.mp4', size: mp4.length });
  assert.equal(result.sourcePath, filePath);
  assert.equal(result.sizeBytes, mp4.length);
  assert.equal(Object.hasOwn(result, 'buffer'), false);
});

test('upload concurrency limiter rejects excess work and releases a slot on completion', () => {
  const limit = createUploadConcurrencyLimit(1);
  const firstRequest = { id: 'one' };
  const firstResponse = new EventEmitter();
  firstResponse.status = () => firstResponse;
  firstResponse.json = () => firstResponse;
  let firstNext = false;
  limit(firstRequest, firstResponse, () => { firstNext = true; });
  assert.equal(firstNext, true);

  let status;
  const secondResponse = new EventEmitter();
  secondResponse.status = value => { status = value; return secondResponse; };
  secondResponse.json = () => secondResponse;
  limit({ id: 'two' }, secondResponse, () => assert.fail('second upload should be rejected'));
  assert.equal(status, 429);

  firstResponse.emit('close');
  status = undefined;
  limit({ id: 'still-blocked' }, secondResponse, () => assert.fail('early close must not release an active upload'));
  assert.equal(status, 429);

  firstRequest.releaseUploadSlot();
  let thirdNext = false;
  const thirdRequest = { id: 'three' };
  limit(thirdRequest, new EventEmitter(), () => { thirdNext = true; });
  assert.equal(thirdNext, true);
  thirdRequest.releaseUploadSlot();
});

test('temporary upload remains owned until the asynchronous operation settles', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'detki-upload-lifecycle-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, 'pending.upload');
  await writeFile(filePath, 'temporary');
  let resolveOperation;
  let released = false;
  const pending = new Promise(resolve => { resolveOperation = resolve; });
  const req = { file: { path: filePath }, releaseUploadSlot: () => { released = true; } };
  const lifecycle = withUploadLifecycle(req, () => pending);

  await access(filePath);
  assert.equal(released, false);
  resolveOperation('done');
  assert.equal(await lifecycle, 'done');
  await assert.rejects(access(filePath), error => error.code === 'ENOENT');
  assert.equal(released, true);
});

test('oversized multipart uploads return a stable 413 response', () => {
  let status;
  let payload;
  const req = { id: 'request-id', log: { error: () => {} } };
  const res = {
    status: value => { status = value; return res; },
    json: value => { payload = value; return res; },
  };
  errorHandler(new multer.MulterError('LIMIT_FILE_SIZE'), req, res, () => {});
  assert.equal(status, 413);
  assert.equal(payload.error.code, 'PAYLOAD_TOO_LARGE');
});

test('storage target is removed when the initial write fails', async t => {
  const source = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#ffffff' } }).png().toBuffer();
  const originalWrite = mediaStorage.write;
  const originalRemove = mediaStorage.remove;
  let attemptedKey;
  let removedKey;
  mediaStorage.write = async (_visibility, key) => { attemptedKey = key; throw new Error('simulated write failure'); };
  mediaStorage.remove = async (_visibility, key) => { removedKey = key; };
  t.after(() => { mediaStorage.write = originalWrite; mediaStorage.remove = originalRemove; });
  await assert.rejects(uploadMedia(
    { buffer: source, originalname: 'safe.png', size: source.length },
    { defaultAlt: 'Описание', rightsConfirmed: true },
    { id: '00000000-0000-4000-8000-000000000000' },
    'request-id',
  ), /simulated write failure/);
  assert.equal(removedKey, attemptedKey);
});

test('external video creation stores only the normalized embed URL', async t => {
  const originalTransaction = prisma.$transaction;
  let created;
  prisma.$transaction = async callback => callback({
    mediaAsset: { create: async ({ data }) => { created = data; return { id: 'video-id', ...data }; } },
    auditLog: { create: async () => ({ id: 'audit-id' }) },
  });
  t.after(() => { prisma.$transaction = originalTransaction; });
  await createExternalVideo(
    { url: 'https://youtu.be/AbCdEf123_-?feature=share', defaultAlt: 'Видео', rightsConfirmed: true },
    { id: '00000000-0000-4000-8000-000000000000' },
    'request-id',
  );
  assert.equal(created.externalUrl, 'https://www.youtube.com/embed/AbCdEf123_-');
});

test('upload validation rejects empty, damaged and oversized files', async () => {
  await assert.rejects(inspectAndNormalize({ buffer: Buffer.alloc(0), originalname: 'empty.jpg', size: 0 }), error => error.code === 'VALIDATION_ERROR');
  const damagedJpeg = Buffer.concat([Buffer.from('ffd8ff', 'hex'), Buffer.alloc(12)]);
  await assert.rejects(inspectAndNormalize({ buffer: damagedJpeg, originalname: 'broken.jpg', size: damagedJpeg.length }));
  const damagedMp4 = Buffer.concat([Buffer.alloc(4), Buffer.from('ftyp'), Buffer.alloc(24)]);
  await assert.rejects(inspectAndNormalize({ buffer: damagedMp4, originalname: 'broken.mp4', size: damagedMp4.length }), error => error.code === 'VALIDATION_ERROR');
  const oversized = Buffer.alloc(10 * 1024 * 1024 + 1);
  oversized[0] = 0xff; oversized[1] = 0xd8; oversized[2] = 0xff;
  await assert.rejects(inspectAndNormalize({ buffer: oversized, originalname: 'large.jpg', size: oversized.length }), error => error.code === 'VALIDATION_ERROR');
});
