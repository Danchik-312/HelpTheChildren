import { env } from '../../config/env.js';
import * as service from './auth.service.js';

const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/api/v1',
  maxAge: env.SESSION_TTL_HOURS * 60 * 60 * 1000,
};

export async function login(req, res) {
  const result = await service.login(req.body, req.id);
  res.cookie(env.SESSION_COOKIE_NAME, result.token, cookieOptions);
  res.status(200).json({ data: { user: result.user, csrfToken: result.csrfToken, expiresAt: result.session.expiresAt } });
}

export async function session(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  const csrfToken = req.auth.csrfToken;
  await service.synchronizeCsrf(req.auth.session.id, csrfToken);
  res.json({ data: { user: service.publicUser(req.auth.user), csrfToken } });
}

export async function logout(req, res) {
  await service.logout(req.auth.session.id, req.auth.user.id, req.id);
  res.clearCookie(env.SESSION_COOKIE_NAME, cookieOptions);
  res.status(204).end();
}

export async function revokeOtherSessions(req, res) {
  await service.revokeOtherSessions(req.auth.user.id, req.auth.session.id, req.id);
  res.status(204).end();
}

export async function changePassword(req, res) {
  await service.changePassword(req.auth.user.id, req.body.currentPassword, req.body.newPassword, req.id);
  res.clearCookie(env.SESSION_COOKIE_NAME, cookieOptions);
  res.status(204).end();
}
