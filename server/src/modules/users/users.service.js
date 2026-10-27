import { prisma } from '../../db/prisma.js';
import { errors } from '../../lib/api-error.js';
import { hashPassword } from '../../lib/crypto.js';
import { pagination, metaFor } from '../../lib/pagination.js';
import { writeAudit } from '../audit/audit.service.js';

const select = { id: true, email: true, displayName: true, role: true, status: true, lastLoginAt: true, createdAt: true, updatedAt: true, permissions: true };

export async function list(query) {
  const { page, pageSize, skip, take } = pagination(query);
  const where = query.q ? { OR: [{ email: { contains: query.q, mode: 'insensitive' } }, { displayName: { contains: query.q, mode: 'insensitive' } }] } : {};
  const [items, total] = await prisma.$transaction([
    prisma.user.findMany({ where, select, skip, take, orderBy: { updatedAt: 'desc' } }),
    prisma.user.count({ where }),
  ]);
  return { items, meta: metaFor(page, pageSize, total) };
}

export async function create(input, actor, requestId) {
  const passwordHash = await hashPassword(input.password);
  return prisma.$transaction(async tx => {
    const user = await tx.user.create({ data: {
      email: input.email, displayName: input.displayName, passwordHash, role: input.role,
      permissions: { create: input.permissions },
    }, select });
    await writeAudit(tx, { actorId: actor.id, action: 'CREATE', entityType: 'User', entityId: user.id, requestId });
    return user;
  });
}

export async function update(id, input, actor, requestId) {
  if (id === actor.id && input.role && input.role !== actor.role) throw errors.badRequest('Нельзя изменить собственную роль.');
  return prisma.$transaction(async tx => {
    const exists = await tx.user.findUnique({ where: { id } });
    if (!exists) throw errors.notFound();
    if (input.permissions) await tx.userContentPermission.deleteMany({ where: { userId: id } });
    const user = await tx.user.update({ where: { id }, data: {
      ...(input.displayName && { displayName: input.displayName }),
      ...(input.role && { role: input.role }),
      ...(input.permissions && { permissions: { create: input.permissions } }),
    }, select });
    if (input.role && input.role !== exists.role) await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    await writeAudit(tx, { actorId: actor.id, action: 'UPDATE', entityType: 'User', entityId: id, requestId });
    return user;
  });
}

export async function setStatus(id, status, actor, requestId) {
  if (id === actor.id && status === 'DISABLED') throw errors.badRequest('Нельзя деактивировать собственную учётную запись.');
  return prisma.$transaction(async tx => {
    const result = await tx.user.updateMany({ where: { id }, data: { status } });
    if (!result.count) throw errors.notFound();
    if (status === 'DISABLED') await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    await writeAudit(tx, { actorId: actor.id, action: status, entityType: 'User', entityId: id, requestId });
  });
}
