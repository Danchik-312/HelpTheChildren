import multer from 'multer';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { ApiError } from '../lib/api-error.js';

export function notFound(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Маршрут не найден.', requestId: req.id } });
}

export function errorHandler(error, req, res, _next) {
  req.log?.error({ err: error, requestId: req.id }, 'request failed');
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Тело запроса содержит некорректный JSON.', requestId: req.id } });
  }
  if (error?.type === 'entity.too.large') {
    return res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Тело запроса превышает допустимый размер.', requestId: req.id } });
  }
  if (error instanceof ZodError) {
    const fields = Object.fromEntries(error.issues.map(issue => [issue.path.join('.') || 'body', issue.message]));
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Проверьте заполненные поля.', fields, requestId: req.id } });
  }
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Файл превышает допустимый размер.', requestId: req.id } });
    }
    return res.status(400).json({ error: { code: 'INVALID_UPLOAD', message: 'Файл не прошёл ограничения загрузки.', requestId: req.id } });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return res.status(409).json({ error: { code: 'UNIQUE_CONFLICT', message: 'Значение уже используется.', requestId: req.id } });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Запись не найдена.', requestId: req.id } });
  }
  if (error instanceof ApiError) {
    return res.status(error.status).json({ error: { code: error.code, message: error.message, ...(error.fields && { fields: error.fields }), requestId: req.id } });
  }
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Внутренняя ошибка сервера.', requestId: req.id } });
}
