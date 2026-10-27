import 'dotenv/config';
import { z } from 'zod';

const booleanString = z.enum(['true', 'false']).transform(value => value === 'true');
const credentialFreeHttpUrl = z.string().url().refine(value => {
  const url = new URL(value);
  return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash;
}, 'Must be an HTTP(S) URL without credentials, query parameters or fragments.');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1),
  ADMIN_ORIGIN: z.string().url().default('http://localhost:3001'),
  PUBLIC_ORIGIN: z.string().url().default('http://localhost:3000'),
  SESSION_COOKIE_NAME: z.string().regex(/^[a-zA-Z0-9_-]+$/).default('cms_session'),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(12),
  CSRF_COOKIE_NAME: z.string().regex(/^[a-zA-Z0-9_-]+$/).default('cms_csrf'),
  CSRF_HMAC_SECRET: z.string().min(32).optional(),
  TRUST_PROXY: booleanString.default('false'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  MEDIA_STORAGE_DRIVER: z.literal('local').default('local'),
  MEDIA_STORAGE_ROOT: z.string().default('./storage'),
  MEDIA_PUBLIC_BASE_URL: credentialFreeHttpUrl.default('http://localhost:4000/api/v1/public/media'),
  MAX_IMAGE_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
  MAX_VIDEO_BYTES: z.coerce.number().int().positive().default(100 * 1024 * 1024),
  ALLOWED_VIDEO_HOSTS: z.string().default('youtube.com,www.youtube.com,youtu.be,vimeo.com,player.vimeo.com'),
});

export function parseEnvironment(source) {
  const configured = schema.superRefine((value, context) => {
    if (value.NODE_ENV === 'production' && !value.CSRF_HMAC_SECRET) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['CSRF_HMAC_SECRET'], message: 'Required in production and must contain at least 32 characters.' });
    }
    if (value.NODE_ENV === 'production' && !source.MEDIA_PUBLIC_BASE_URL) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['MEDIA_PUBLIC_BASE_URL'], message: 'Must be explicitly configured in production.' });
    }
  });
  const parsed = configured.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  return {
    ...parsed.data,
    allowedVideoHosts: parsed.data.ALLOWED_VIDEO_HOSTS.split(',').map(value => value.trim().toLowerCase()).filter(Boolean),
  };
}

export const env = parseEnvironment(process.env);
