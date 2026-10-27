import { prisma } from '../../db/prisma.js';
import { env } from '../../config/env.js';
import { ApiError, errors } from '../../lib/api-error.js';
import { deriveCsrfToken, hashPassword, hashToken, randomToken, verifyPassword } from '../../lib/crypto.js';
import { writeAudit } from '../audit/audit.service.js';

const publicUser = user => ({
  id: user.id, email: user.email, displayName: user.displayName, role: user.role,
  permissions: user.permissions || [],
});

export async function login({ email, password }, requestId) {
  const user = await prisma.user.findUnique({ where: { email }, include: { permissions: true } });
  const valid = user && user.status === 'ACTIVE' && await verifyPassword(password, user.passwordHash);
  if (!valid) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Неверный email или пароль.');
  const token = randomToken();
  const csrfToken = deriveCsrfToken(token);
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_HOURS * 60 * 60 * 1000);
  const session = await prisma.$transaction(async tx => {
    const created = await tx.session.create({ data: { userId: user.id, tokenHash: hashToken(token), csrfHash: hashToken(csrfToken), expiresAt } });
    await tx.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await writeAudit(tx, { actorId: user.id, action: 'LOGIN', entityType: 'User', entityId: user.id, requestId });
    return created;
  });
  return { user: publicUser(user), token, csrfToken, session };
}

export async function logout(sessionId, actorId, requestId) {
  await prisma.$transaction(async tx => {
    await tx.session.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
    await writeAudit(tx, { actorId, action: 'LOGOUT', entityType: 'Session', entityId: sessionId, requestId });
  });
}

export async function synchronizeCsrf(sessionId, csrfToken) {
  const csrfHash = hashToken(csrfToken);
  await prisma.session.update({ where: { id: sessionId }, data: { csrfHash, lastSeenAt: new Date() } });
}

export async function revokeOtherSessions(userId, currentSessionId, requestId) {
  await prisma.$transaction(async tx => {
    await tx.session.updateMany({ where: { userId, id: { not: currentSessionId }, revokedAt: null }, data: { revokedAt: new Date() } });
    await writeAudit(tx, { actorId: userId, action: 'REVOKE_SESSIONS', entityType: 'User', entityId: userId, requestId });
  });
}

export async function changePassword(userId, currentPassword, newPassword, requestId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) throw errors.badRequest('Текущий пароль неверен.');
  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction(async tx => {
    await tx.user.update({ where: { id: userId }, data: { passwordHash } });
    await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await writeAudit(tx, { actorId: userId, action: 'PASSWORD_CHANGE', entityType: 'User', entityId: userId, requestId });
  });
}

export { publicUser };
