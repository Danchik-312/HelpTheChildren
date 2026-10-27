import { z } from 'zod';
import { SLUG_PATTERN, normalizeSlug } from '../../lib/slug.js';
import { structuredContentSchema } from './structured-content.validation.js';

const slug = z.string().transform(normalizeSlug).pipe(z.string().min(1).max(160).regex(SLUG_PATTERN));
const body = structuredContentSchema;
const base = { slug, title: z.string().trim().min(1).max(240), coverMediaId: z.string().uuid().nullable().optional(), version: z.number().int().positive().optional() };

export const schemas = {
  publications: z.object({ ...base, kind: z.enum(['NEWS', 'ARTICLE']), excerpt: z.string().trim().min(1).max(1000), body, categoryIds: z.array(z.string().uuid()).max(30).optional() }).strict(),
  stories: z.object({ ...base, excerpt: z.string().trim().min(1).max(1000), body, consentConfirmed: z.boolean().default(false) }).strict(),
  children: z.object({ ...base, publicDisplayName: z.string().trim().min(1).max(120), summary: z.string().trim().min(1).max(1000), storyBody: body, publicAgeLabel: z.string().trim().max(80).nullable().optional(), approvedHealthSummary: z.string().trim().max(1000).nullable().optional(), supportReason: z.string().trim().min(1).max(1000), sortOrder: z.number().int().min(0).max(100000).default(0) }).strict(),
  projects: z.object({ ...base, kind: z.enum(['PROJECT', 'PROGRAM', 'INITIATIVE']), projectState: z.enum(['PLANNED', 'ACTIVE', 'COMPLETED']).default('PLANNED'), summary: z.string().trim().min(1).max(1000), body, startsAt: z.coerce.date().nullable().optional(), endsAt: z.coerce.date().nullable().optional(), sortOrder: z.number().int().min(0).max(100000).default(0) }).strict(),
  pages: z.object({ ...base, group: z.enum(['ABOUT', 'GIVE_HELP', 'GET_HELP', 'GENERAL']), description: z.string().trim().min(1).max(1000), body, sortOrder: z.number().int().min(0).max(100000).default(0) }).strict(),
};

export const versionSchema = z.object({ version: z.number().int().positive() }).strict();
export const publicListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
  kind: z.enum(['NEWS', 'ARTICLE', 'PROJECT', 'PROGRAM', 'INITIATIVE']).optional(),
  categoryId: z.string().uuid().optional(),
  group: z.enum(['ABOUT', 'GIVE_HELP', 'GET_HELP', 'GENERAL']).optional(),
}).strict();
