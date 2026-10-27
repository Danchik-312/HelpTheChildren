import { errors } from './api-error.js';

export function pagination(query, max = 100) {
  const page = Number(query.page || 1);
  const pageSize = Number(query.pageSize || 20);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > max) {
    throw errors.badRequest('Некорректные параметры пагинации.');
  }
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export const metaFor = (page, pageSize, total) => ({ page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
