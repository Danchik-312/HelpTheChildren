import { z } from 'zod';

const role = z.enum(['ADMIN', 'EDITOR']);
const area = z.enum(['PUBLICATIONS', 'STORIES', 'CHILDREN', 'PROJECTS', 'PAGES', 'HERO', 'MEDIA', 'SITE']);

export const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  displayName: z.string().trim().min(2).max(120),
  password: z.string().min(12).max(128),
  role: role.default('EDITOR'),
  permissions: z.array(z.object({ area, canPublish: z.boolean().default(false) }).strict()).max(8).default([]),
}).strict();

export const updateUserSchema = z.object({
  displayName: z.string().trim().min(2).max(120).optional(),
  role: role.optional(),
  permissions: z.array(z.object({ area, canPublish: z.boolean().default(false) }).strict()).max(8).optional(),
}).strict();
