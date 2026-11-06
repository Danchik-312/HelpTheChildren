import { z } from 'zod';
import { SLUG_PATTERN, normalizeSlug } from '../../lib/slug.js';
import { structuredContentSchema } from './structured-content.validation.js';

const slug = z.string().transform(normalizeSlug).pipe(z.string().min(1).max(160).regex(SLUG_PATTERN, 'Используйте латинские буквы, цифры и дефисы между частями slug.'));
const body = structuredContentSchema;
const emptyBody = { type: 'doc', content: [{ type: 'paragraph' }] };
const shortText = z.string().trim().max(1000);
const sidePhotos = z.array(z.object({
  mediaId: z.string().uuid().transform(id => id.toLowerCase()),
  altText: z.string().trim().max(500).optional().default(''),
  caption: z.string().trim().max(500).optional().default(''),
}).strict()).max(30).refine(photos => new Set(photos.map(photo => photo.mediaId)).size === photos.length, 'Фотографии не должны повторяться.');

const base = { slug, title: z.string().trim().min(1).max(240), coverMediaId: z.string().uuid().nullable().optional(), version: z.number().int().positive().optional() };

const contentSchemas = {
  publications: z.object({ ...base, kind: z.enum(['NEWS', 'ARTICLE']), excerpt: shortText, body, sidePhotos: sidePhotos.optional(), categoryIds: z.array(z.string().uuid()).max(30).optional() }).strict(),
  stories: z.object({ ...base, excerpt: shortText, body, consentConfirmed: z.boolean().optional() }).strict(),
  children: z.object({ ...base, publicDisplayName: z.string().trim().max(120), summary: shortText, storyBody: body, publicAgeLabel: z.string().trim().max(80).nullable().optional(), approvedHealthSummary: z.string().trim().max(1000).nullable().optional(), supportReason: shortText, sortOrder: z.number().int().min(0).max(100000).optional() }).strict(),
  projects: z.object({ ...base, kind: z.enum(['PROJECT', 'PROGRAM', 'INITIATIVE']), projectState: z.enum(['PLANNED', 'ACTIVE', 'COMPLETED']).optional(), summary: shortText, body, startsAt: z.coerce.date().nullable().optional(), endsAt: z.coerce.date().nullable().optional(), sortOrder: z.number().int().min(0).max(100000).optional() }).strict(),
  pages: z.object({ ...base, group: z.enum(['ABOUT', 'GIVE_HELP', 'GET_HELP', 'GENERAL']), description: shortText, body, sortOrder: z.number().int().min(0).max(100000).optional() }).strict(),
};

export const versionSchema = z.object({ version: z.number().int().positive() }).strict();
export const schemas = {
  publications: contentSchemas.publications.extend({
    kind: contentSchemas.publications.shape.kind.default('NEWS'), excerpt: shortText.default(''), body: body.default(emptyBody),
  }),
  stories: contentSchemas.stories.extend({ excerpt: shortText.default(''), body: body.default(emptyBody) }),
  children: contentSchemas.children.extend({
    publicDisplayName: contentSchemas.children.shape.publicDisplayName.default(''),
    summary: shortText.default(''), supportReason: shortText.default(''), storyBody: body.default(emptyBody),
  }),
  projects: contentSchemas.projects.extend({
    kind: contentSchemas.projects.shape.kind.default('PROJECT'), summary: shortText.default(''), body: body.default(emptyBody),
  }),
  pages: contentSchemas.pages.extend({ description: shortText.default(''), body: body.default(emptyBody) }),
};

export const patchSchemas = Object.fromEntries(Object.entries(contentSchemas).map(([resource, schema]) =>
  [resource, schema.partial().extend({ version: versionSchema.shape.version })],
));

export const publicListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
  kind: z.enum(['NEWS', 'ARTICLE', 'PROJECT', 'PROGRAM', 'INITIATIVE']).optional(),
  categoryId: z.string().uuid().optional(),
  group: z.enum(['ABOUT', 'GIVE_HELP', 'GET_HELP', 'GENERAL']).optional(),
}).strict();
