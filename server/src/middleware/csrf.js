import { env } from '../config/env.js';
import { hashToken, safeHashEquals } from '../lib/crypto.js';
import { errors } from '../lib/api-error.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function requireAdminOrigin(req, _res, next) {
  return req.get('origin') === env.ADMIN_ORIGIN ? next() : next(errors.forbidden());
}

export function csrfProtection(req, _res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  if (req.get('origin') !== env.ADMIN_ORIGIN) return next(errors.forbidden());
  const token = req.get('x-csrf-token');
  if (!token || !req.auth?.session || !safeHashEquals(hashToken(token), req.auth.session.csrfHash)) return next(errors.forbidden());
  next();
}
