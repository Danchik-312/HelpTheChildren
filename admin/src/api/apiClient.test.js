import { vi } from 'vitest';
import { apiRequest, ApiError, setCsrfToken, subscribeUnauthorized } from './apiClient';

afterEach(() => {
  vi.restoreAllMocks();
  setCsrfToken(null);
});

test('отправляет cookie и CSRF для изменяющего запроса', async () => {
  setCsrfToken('test-token');
  vi.spyOn(global, 'fetch').mockResolvedValue({
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
  vi.spyOn(global, 'fetch').mockResolvedValue({
    ok: false,
    status: 403,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => ({ error: { code: 'FORBIDDEN', message: 'Нет доступа', requestId: 'req-1' } }),
  });
  await expect(apiRequest('/admin/example')).rejects.toMatchObject({ name: 'ApiError', status: 403, code: 'FORBIDDEN', requestId: 'req-1' });
  expect(ApiError).toBeDefined();
});

test('сохраняет meta пагинации рядом с данными списка', async () => {
  vi.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => ({ data: { items: [{ id: '1' }] }, meta: { page: 1, total: 1, totalPages: 1 } }),
  });
  await expect(apiRequest('/admin/publications')).resolves.toEqual({ items: [{ id: '1' }], meta: { page: 1, total: 1, totalPages: 1 } });
});


test('sends FormData unchanged without a JSON content type', async () => {
  setCsrfToken('upload-token');
  const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true, status: 204, headers: new Headers() });
  const body = new FormData();
  body.append('file', new File(['image'], 'cover.png', { type: 'image/png' }));
  await apiRequest('/admin/media', { method: 'POST', body });
  const options = fetchMock.mock.calls[0][1];
  expect(options.body).toBe(body);
  expect(options.credentials).toBe('include');
  expect(options.headers.has('Content-Type')).toBe(false);
  expect(options.headers.get('X-CSRF-Token')).toBe('upload-token');
});

test('notifies unauthorized subscribers and clears CSRF before the next unsafe request', async () => {
  setCsrfToken('expired-token');
  const listener = vi.fn();
  const unsubscribe = subscribeUnauthorized(listener);
  const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
    ok: false, status: 401, headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => ({ error: { code: 'UNAUTHORIZED', message: 'Session expired' } }),
  }).mockResolvedValue({ ok: true, status: 204, headers: new Headers() });
  try {
    await expect(apiRequest('/auth/session')).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
    expect(listener).toHaveBeenCalledTimes(1);
    await apiRequest('/admin/example', { method: 'POST', body: {} });
    expect(fetchMock.mock.calls[1][1].headers.has('X-CSRF-Token')).toBe(false);
    expect(fetchMock.mock.calls[1][1].credentials).toBe('include');
  } finally { unsubscribe(); }
});
