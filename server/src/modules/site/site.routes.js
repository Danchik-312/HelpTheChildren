import { Router } from 'express';
import { asyncHandler } from '../../lib/async-handler.js';
import { requireArea, requireRole } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './site.controller.js';
import { blockSchema, contactPatchSchema, contactSchema, organizationSchema } from './site.validation.js';

export const siteAdminRouter = Router();
siteAdminRouter.get('/', requireArea('SITE', 'read'), asyncHandler(controller.adminGet));
siteAdminRouter.patch('/organization', requireRole('ADMIN'), validate(organizationSchema), asyncHandler(controller.organization));
siteAdminRouter.post('/contacts', requireRole('ADMIN'), validate(contactSchema), asyncHandler(controller.createContact));
siteAdminRouter.patch('/contacts/:id', requireRole('ADMIN'), validate(contactPatchSchema), asyncHandler(controller.updateContact));
siteAdminRouter.delete('/contacts/:id', requireRole('ADMIN'), asyncHandler(controller.deleteContact));
siteAdminRouter.put('/blocks/:key', requireRole('ADMIN'), (req, _res, next) => { req.body.key = req.params.key; next(); }, validate(blockSchema), asyncHandler(controller.block));

export const sitePublicRouter = Router();
sitePublicRouter.get('/', asyncHandler(controller.publicGet));
