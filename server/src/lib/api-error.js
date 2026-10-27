export class ApiError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export const errors = {
  badRequest: (message = 'Некорректный запрос.', fields) => new ApiError(400, 'VALIDATION_ERROR', message, fields),
  unauthenticated: () => new ApiError(401, 'AUTHENTICATION_REQUIRED', 'Требуется авторизация.'),
  forbidden: () => new ApiError(403, 'FORBIDDEN', 'Недостаточно прав.'),
  notFound: () => new ApiError(404, 'NOT_FOUND', 'Запись не найдена.'),
  conflict: (code, message) => new ApiError(409, code, message),
  unprocessable: (message, fields) => new ApiError(422, 'PUBLICATION_REQUIREMENTS_NOT_MET', message, fields),
};
