import { apiRequest, ApiError, setCsrfToken } from './apiClient';

afterEach(() => {
  jest.restoreAllMocks();
  setCsrfToken(null);
});

test('отправляет cookie и CSRF для изменяющего запроса', async () => {
  setCsrfToken('test-token');
  jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => ({ data: { ok: true } }),
  });

  await expect(apiRequest('/admin/example', { method: 'POST', body: { title: 'Test' } })).resolves.toEqual({ ok: true });
  const options = global.fetch.mock.calls[0][1];
  expect(options.credentials).toBe('include');
  expect(options.headers.get('X-CSRF-Token')).toBe('test-token');
  expect(options.body).toBe(JSON.stringify({ title: 'Test' }));
});

test('преобразует ошибку API в ApiError', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: false,
    status: 403,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => ({ error: { code: 'FORBIDDEN', message: 'Нет доступа', requestId: 'req-1' } }),
  });
  await expect(apiRequest('/admin/example')).rejects.toMatchObject({ name: 'ApiError', status: 403, code: 'FORBIDDEN', requestId: 'req-1' });
  expect(ApiError).toBeDefined();
});

test('сохраняет meta пагинации рядом с данными списка', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => ({ data: { items: [{ id: '1' }] }, meta: { page: 1, total: 1, totalPages: 1 } }),
  });
  await expect(apiRequest('/admin/publications')).resolves.toEqual({ items: [{ id: '1' }], meta: { page: 1, total: 1, totalPages: 1 } });
});
