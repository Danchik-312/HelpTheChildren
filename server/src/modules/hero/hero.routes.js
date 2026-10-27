import { Router } from 'express';
import { asyncHandler } from '../../lib/async-handler.js';
import { requireArea } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './hero.controller.js';
import { heroSchema, heroUpdateSchema, orderSchema, versionSchema } from './hero.validation.js';

export const heroAdminRouter = Router();
heroAdminRouter.use(requireArea('HERO'));
heroAdminRouter.get('/', asyncHandler(controller.list));
heroAdminRouter.post('/', validate(heroSchema), asyncHandler(controller.create));
heroAdminRouter.patch('/:id', validate(heroUpdateSchema), asyncHandler(controller.update));
heroAdminRouter.delete('/:id', asyncHandler(controller.archive));
heroAdminRouter.post('/:id/publish', requireArea('HERO', 'publish'), validate(versionSchema), asyncHandler(controller.publish(true)));
heroAdminRouter.post('/:id/unpublish', requireArea('HERO', 'publish'), validate(versionSchema), asyncHandler(controller.publish(false)));
heroAdminRouter.put('/order', validate(orderSchema), asyncHandler(controller.reorder));

export const heroPublicRouter = Router();
heroPublicRouter.get('/', asyncHandler(controller.publicList));
