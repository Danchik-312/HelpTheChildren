import { Router } from 'express';
import multer from 'multer';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { requireArea, requireRole } from '../../middleware/authorize.js';
import { uploadRateLimit } from '../../middleware/rate-limit.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './media.controller.js';
import { externalVideoSchema, mediaIdParamsSchema, metadataSchema } from './media.validation.js';

const uploadTempRoot = path.resolve(process.cwd(), env.MEDIA_STORAGE_ROOT, 'upload-temp');
mkdirSync(uploadTempRoot, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, uploadTempRoot),
    filename: (_req, _file, callback) => callback(null, `${randomUUID()}.upload`),
  }),
  limits: { files: 1, fileSize: Math.max(env.MAX_IMAGE_BYTES, env.MAX_VIDEO_BYTES), fields: 8, fieldSize: 20_000, parts: 10 },
});

export function createUploadConcurrencyLimit(maxActive = 2) {
  let active = 0;
  return (req, res, next) => {
    if (active >= maxActive) return res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Слишком много одновременных загрузок.', requestId: req.id } });
    active += 1;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      active = Math.max(0, active - 1);
    };
    req.releaseUploadSlot = release;
    next();
  };
}

const uploadConcurrencyLimit = createUploadConcurrencyLimit();
const receiveSingleUpload = (req, res, next) => {
  upload.single('file')(req, res, error => {
    if (!error) return next();
    controller.finalizeUploadRequest(req).then(() => next(error), next);
  });
};
const parseUploadMetadata = (req, _res, next) => {
  try {
    req.body = metadataSchema.parse({ ...req.body, rightsConfirmed: req.body.rightsConfirmed === 'true' });
    next();
  } catch (error) {
    controller.finalizeUploadRequest(req).then(() => next(error), next);
  }
};

export const mediaAdminRouter = Router();
mediaAdminRouter.get('/', requireArea('MEDIA', 'read'), asyncHandler(controller.list));
mediaAdminRouter.post('/', requireArea('MEDIA'), uploadRateLimit, uploadConcurrencyLimit, receiveSingleUpload, parseUploadMetadata, asyncHandler(controller.upload));
mediaAdminRouter.post('/external-video', requireArea('MEDIA'), validate(externalVideoSchema), asyncHandler(controller.external));
mediaAdminRouter.patch('/:id', requireArea('MEDIA'), validate(mediaIdParamsSchema, 'params'), validate(metadataSchema), asyncHandler(controller.update));
mediaAdminRouter.get('/:id/usages', requireArea('MEDIA', 'read'), validate(mediaIdParamsSchema, 'params'), asyncHandler(controller.usages));
mediaAdminRouter.get('/:id/content', requireArea('MEDIA', 'read'), validate(mediaIdParamsSchema, 'params'), asyncHandler(controller.adminStream));
mediaAdminRouter.delete('/:id', requireRole('ADMIN'), validate(mediaIdParamsSchema, 'params'), asyncHandler(controller.remove));

export const mediaPublicRouter = Router();
mediaPublicRouter.get('/:id', validate(mediaIdParamsSchema, 'params'), asyncHandler(controller.stream));
