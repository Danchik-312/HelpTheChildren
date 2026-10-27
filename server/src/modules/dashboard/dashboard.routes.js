import { Router } from 'express';
import { asyncHandler } from '../../lib/async-handler.js';
import { getDashboard } from './dashboard.service.js';
export const dashboardRouter = Router();
dashboardRouter.get('/', asyncHandler(async (req, res) => res.json({ data: await getDashboard(req.auth.user) })));
