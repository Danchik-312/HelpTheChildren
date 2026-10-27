import { Router } from 'express';
import { asyncHandler } from '../../lib/async-handler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { csrfProtection, requireAdminOrigin } from '../../middleware/csrf.js';
import { loginRateLimit } from '../../middleware/rate-limit.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './auth.controller.js';
import { changePasswordSchema, loginSchema } from './auth.validation.js';

export const authRouter = Router();
authRouter.post('/login', requireAdminOrigin, loginRateLimit, validate(loginSchema), asyncHandler(controller.login));
authRouter.get('/session', requireAdminOrigin, asyncHandler(authenticate), asyncHandler(controller.session));
authRouter.post('/logout', asyncHandler(authenticate), csrfProtection, asyncHandler(controller.logout));
authRouter.delete('/sessions', asyncHandler(authenticate), csrfProtection, asyncHandler(controller.revokeOtherSessions));
authRouter.patch('/password', asyncHandler(authenticate), csrfProtection, validate(changePasswordSchema), asyncHandler(controller.changePassword));
