import { z } from 'zod';

export const mediaIdParamsSchema = z.object({ id: z.string().uuid() }).strict();

export const metadataSchema = z.object({
  defaultAlt: z.string().trim().max(500).nullable().optional(),
  caption: z.string().trim().max(1000).nullable().optional(),
  credit: z.string().trim().max(500).nullable().optional(),
  rightsConfirmed: z.boolean().optional(),
}).strict();

export const externalVideoSchema = z.object({
  url: z.string().url().max(2000).refine(value => {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  }, 'Видео должно использовать HTTPS URL без встроенных учётных данных.'),
  defaultAlt: z.string().trim().min(1).max(500),
  rightsConfirmed: z.boolean(),
}).strict();
