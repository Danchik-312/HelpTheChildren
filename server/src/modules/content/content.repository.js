import { prisma } from '../../db/prisma.js';
import { contentConfig } from './content.config.js';

export const delegateFor = resource => prisma[contentConfig[resource].delegate];

export function adminWhere(resource, query) {
  const clauses = [{ deletedAt: null }];
  if (query.status) clauses.push({ status: query.status });
  if (query.kind && ['publications', 'projects'].includes(resource)) clauses.push({ kind: query.kind });
  if (query.categoryId && resource === 'publications') clauses.push({ categories: { some: { categoryId: query.categoryId } } });
  if (query.group && resource === 'pages') clauses.push({ group: query.group });
  if (query.q) clauses.push({ OR: [{ title: { contains: query.q, mode: 'insensitive' } }, { slug: { contains: query.q, mode: 'insensitive' } }] });
  return { AND: clauses };
}

export function publicWhere(resource, extra = {}) {
  const where = { ...extra, status: 'PUBLISHED', publishedAt: { lte: new Date() }, deletedAt: null };
  return where;
}
