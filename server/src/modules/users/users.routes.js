import { Router } from 'express';
import { asyncHandler } from '../../lib/async-handler.js';
import { requireRole } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './users.controller.js';
import { createUserSchema, updateUserSchema } from './users.validation.js';

export const usersRouter = Router();
usersRouter.use(requireRole('ADMIN'));
usersRouter.get('/', asyncHandler(controller.list));
usersRouter.post('/', validate(createUserSchema), asyncHandler(controller.create));
usersRouter.patch('/:id', validate(updateUserSchema), asyncHandler(controller.update));
usersRouter.post('/:id/activate', asyncHandler(controller.activate));
usersRouter.post('/:id/deactivate', asyncHandler(controller.deactivate));
