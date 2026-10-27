import { Router } from 'express';
import { prisma } from '../../db/prisma.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { pagination, metaFor } from '../../lib/pagination.js';
import { requireRole } from '../../middleware/authorize.js';

export const auditRouter = Router();
auditRouter.use(requireRole('ADMIN'));
auditRouter.get('/', asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = pagination(req.query);
  const [items, total] = await prisma.$transaction([
    prisma.auditLog.findMany({ skip, take, orderBy: { createdAt: 'desc' }, select: { id: true, action: true, entityType: true, entityId: true, summary: true, requestId: true, createdAt: true, actor: { select: { id: true, displayName: true } } } }),
    prisma.auditLog.count(),
  ]);
  res.json({ data: { items: items.map(item => ({ ...item, id: item.id.toString() })) }, meta: metaFor(page, pageSize, total) });
}));
