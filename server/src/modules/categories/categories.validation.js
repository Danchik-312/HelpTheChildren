import { z } from 'zod';
import { SLUG_PATTERN, normalizeSlug } from '../../lib/slug.js';

const slug = z.string().trim().transform(normalizeSlug).pipe(z.string().min(1).max(160).regex(SLUG_PATTERN));
export const categorySchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug,
}).strict();
export const categoryParamsSchema = z.object({ id: z.string().uuid() }).strict();
