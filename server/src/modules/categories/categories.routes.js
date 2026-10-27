import { Router } from 'express';
import { asyncHandler } from '../../lib/async-handler.js';
import { requireArea, requireRole } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './categories.controller.js';
import { categoryParamsSchema, categorySchema } from './categories.validation.js';

export const categoriesAdminRouter = Router();
categoriesAdminRouter.get('/', requireArea('PUBLICATIONS', 'read'), asyncHandler(controller.adminList));
categoriesAdminRouter.use(requireRole('ADMIN'));
categoriesAdminRouter.post('/', validate(categorySchema), asyncHandler(controller.create));
categoriesAdminRouter.patch('/:id', validate(categoryParamsSchema, 'params'), validate(categorySchema), asyncHandler(controller.update));
categoriesAdminRouter.delete('/:id', validate(categoryParamsSchema, 'params'), asyncHandler(controller.remove));

export const categoriesPublicRouter = Router();
categoriesPublicRouter.get('/', asyncHandler(controller.publicList));
