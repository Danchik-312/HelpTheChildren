import { z } from 'zod';
import { structuredContentSchema } from '../content/structured-content.validation.js';

export function isSafeContactHref(value) {
  if (value.startsWith('/')) return !value.startsWith('//');
  try {
    const url = new URL(value);
    if (url.protocol === 'https:') return !url.username && !url.password;
    return ['mailto:', 'tel:'].includes(url.protocol);
  } catch {
    return false;
  }
}

const safeContactHref = z.string().trim().max(1000).refine(isSafeContactHref, 'Ссылка должна быть внутренней или использовать HTTPS, mailto либо tel.');

export const organizationSchema = z.object({
  displayName: z.string().trim().min(1).max(200),
  shortDescription: z.string().trim().max(1000).nullable().optional(),
  description: structuredContentSchema.nullable().optional(),
}).strict();

const contactShape = {
  type: z.enum(['PHONE', 'EMAIL', 'ADDRESS', 'HOURS', 'SOCIAL', 'OTHER']),
  label: z.string().trim().min(1).max(120),
  value: z.string().trim().min(1).max(500),
  href: safeContactHref.nullable().optional(),
  isPublic: z.boolean(),
  sortOrder: z.number().int().min(0).max(100000),
};

export const contactSchema = z.object(contactShape).extend({
  isPublic: contactShape.isPublic.default(false),
  sortOrder: contactShape.sortOrder.default(0),
}).strict();

// Do not derive this with contactSchema.partial(): Zod defaults would then turn
// omitted fields into values and make PATCH destructive.
export const contactPatchSchema = z.object(Object.fromEntries(
  Object.entries(contactShape).map(([key, value]) => [key, value.optional()]),
)).strict().refine(value => Object.keys(value).length > 0, 'Укажите хотя бы одно поле для изменения.');

export const blockSchema = z.object({
  key: z.enum(['children', 'help', 'projects', 'publications', 'friends']),
  enabled: z.boolean(), position: z.number().int().min(0).max(100), itemLimit: z.number().int().min(1).max(50).nullable().optional(),
  heading: z.string().trim().max(240).nullable().optional(), description: z.string().trim().max(1000).nullable().optional(), config: z.record(z.string(), z.unknown()).nullable().optional(),
}).strict();
