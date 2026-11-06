import { Router } from 'express';
import { asyncHandler } from '../../lib/async-handler.js';
import { requireArea } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { contentConfig } from './content.config.js';
import * as controller from './content.controller.js';
import { patchSchemas, publicListQuerySchema, schemas, versionSchema } from './content.validation.js';

export function contentAdminRouter(resource) {
  const router = Router();
  const { area } = contentConfig[resource];
  router.get('/', requireArea(area, 'read'), asyncHandler(controller.adminList(resource)));
  router.post('/', requireArea(area), validate(schemas[resource]), asyncHandler(controller.create(resource)));
  router.get('/:id', requireArea(area, 'read'), asyncHandler(controller.adminGet(resource)));
  router.patch('/:id', requireArea(area), validate(patchSchemas[resource]), asyncHandler(controller.update(resource)));
  router.delete('/:id', requireArea(area), asyncHandler(controller.archive(resource)));
  router.post('/:id/restore', requireArea(area), asyncHandler(controller.restore(resource)));
  router.post('/:id/publish', requireArea(area, 'publish'), validate(versionSchema), asyncHandler(controller.publish(resource, true)));
  router.post('/:id/unpublish', requireArea(area, 'publish'), validate(versionSchema), asyncHandler(controller.publish(resource, false)));
  router.get('/:id/preview', requireArea(area, 'read'), asyncHandler(controller.preview(resource)));
  return router;
}

export function contentPublicRouter(resource) {
  const router = Router();
  if (resource === 'pages') router.get('/:group/:slug', asyncHandler(controller.publicPageGet));
  router.get('/', validate(publicListQuerySchema, 'query'), asyncHandler(controller.publicList(resource)));
  router.get('/:slug', asyncHandler(controller.publicGet(resource)));
  return router;
}
