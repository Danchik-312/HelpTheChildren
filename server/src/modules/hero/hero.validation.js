import { z } from 'zod';

const heroObject = z.object({
  title: z.string().trim().max(240).nullable().optional(),
  subtitle: z.string().trim().min(1).max(1000),
  mediaId: z.string().uuid(),
  posterMediaId: z.string().uuid().nullable().optional(),
  altText: z.string().trim().max(500).nullable().optional(),
  isDecorative: z.boolean().default(false),
  ctaLabel: z.string().trim().max(120).nullable().optional(),
  ctaUrl: z.string().trim().regex(/^\/(?!\/)[a-z0-9\-/?=&]*$/).max(500).nullable().optional(),
  position: z.number().int().min(0).max(100000).default(0),
  version: z.number().int().positive().optional(),
}).strict();

export const heroSchema = heroObject.superRefine((value, context) => {
  if (!value.isDecorative && !value.altText) context.addIssue({ code: 'custom', path: ['altText'], message: 'Для недекоративного медиа требуется alt.' });
});

export const heroUpdateSchema = heroObject.partial().extend({ version: z.number().int().positive() });

export const orderSchema = z.object({ items: z.array(z.object({ id: z.string().uuid(), position: z.number().int().min(0).max(100000), version: z.number().int().positive() }).strict()).min(1).max(100) }).strict();
export const versionSchema = z.object({ version: z.number().int().positive() }).strict();
