import { vi } from 'vitest';

beforeEach(() => { vi.resetModules(); });

test('uses the build-time Vite API URL without dropping session credentials or CSRF', async () => {
  vi.stubEnv('VITE_API_URL', 'https://api.example.test/api/v1/');
  const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true, status: 204, headers: new Headers() });
  const { apiRequest, setCsrfToken } = await import('./apiClient');
  setCsrfToken('csrf-test');
  await expect(apiRequest('/admin/example', { method: 'POST', body: { title: 'Test' } })).resolves.toBeNull();
  expect(fetchMock.mock.calls[0][0]).toBe('https://api.example.test/api/v1/admin/example');
  const options = fetchMock.mock.calls[0][1];
  expect(options.credentials).toBe('include');
  expect(options.headers.get('X-CSRF-Token')).toBe('csrf-test');
});
