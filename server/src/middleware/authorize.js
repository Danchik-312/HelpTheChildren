import { hasPermission } from '../config/permissions.js';
import { errors } from '../lib/api-error.js';

export const requireRole = role => (req, _res, next) => req.auth?.user.role === role ? next() : next(errors.forbidden());

export const requireArea = (area, action = 'write') => (req, _res, next) => {
  return hasPermission(req.auth.user, area, action) ? next() : next(errors.forbidden());
};
