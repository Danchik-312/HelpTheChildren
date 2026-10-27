import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { env } from './config/env.js';
import { jsonReplacer } from './lib/json.js';
import { errorHandler, notFound } from './middleware/error-handler.js';
import { requestId } from './middleware/request-id.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { adminRouter } from './routes/admin.routes.js';
import { publicRouter } from './routes/public.routes.js';

export const sensitiveLogPaths = Object.freeze([
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-csrf-token"]',
  'req.headers["x-xsrf-token"]',
  'req.headers["proxy-authorization"]',
  'req.body.password',
  'req.body.currentPassword',
  'req.body.newPassword',
  'req.body.csrfToken',
  'req.body.sessionToken',
  'req.body.accessToken',
  'req.body.refreshToken',
  'res.headers["set-cookie"]',
]);

export function createApp() {
  const app = express();
  app.set('json replacer', jsonReplacer);
  if (env.TRUST_PROXY) app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(requestId);
  app.use(pinoHttp({
    level: env.LOG_LEVEL,
    redact: { paths: sensitiveLogPaths, censor: '[Redacted]' },
    genReqId: req => req.id,
  }));
  app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } }, crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(cors((req, callback) => {
    const origin = req.get('Origin');
    const adminApi = req.path.startsWith('/api/v1/admin') || req.path.startsWith('/api/v1/auth');
    const allowedOrigins = adminApi ? [env.ADMIN_ORIGIN] : [env.ADMIN_ORIGIN, env.PUBLIC_ORIGIN];
    callback(null, {
      origin: origin && allowedOrigins.includes(origin) ? origin : false,
      credentials: adminApi,
      methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    });
  }));
  app.use(express.json({ limit: '1mb', strict: true }));
  app.use(express.urlencoded({ extended: false, limit: '32kb', parameterLimit: 20 }));
  app.use(cookieParser());
  app.get('/health', (_req, res) => res.json({ data: { status: 'ok' } }));
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/public', publicRouter);
  app.use('/api/v1/admin', adminRouter);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
