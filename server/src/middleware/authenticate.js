import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';
import { deriveCsrfToken, hashToken } from '../lib/crypto.js';
import { errors } from '../lib/api-error.js';

export async function authenticate(req, _res, next) {
  const token = req.cookies?.[env.SESSION_COOKIE_NAME];
  if (!token) return next(errors.unauthenticated());
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: { permissions: true } } },
  });
  if (!session || session.revokedAt || session.expiresAt <= new Date() || session.user.status !== 'ACTIVE') {
    return next(errors.unauthenticated());
  }
  req.auth = { session, user: session.user, csrfToken: deriveCsrfToken(token) };
  next();
}
