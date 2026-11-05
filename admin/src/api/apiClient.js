const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1').replace(/\/$/, '');

let csrfToken = null;
const unauthorizedListeners = new Set();

export class ApiError extends Error {
  constructor(status, payload) {
    super(payload?.message || 'Не удалось выполнить запрос.');
    this.name = 'ApiError';
    this.status = status;
    this.code = payload?.code || 'REQUEST_FAILED';
    this.fields = payload?.fields || {};
    this.requestId = payload?.requestId;
  }
}

export function setCsrfToken(token) {
  csrfToken = typeof token === 'string' && token ? token : null;
}

export function subscribeUnauthorized(listener) {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

async function parseResponse(response) {
  if (response.status === 204) return null;
  const contentType = response.headers.get('content-type') || '';
  return contentType.includes('application/json') ? response.json() : null;
}

async function request(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers);
  const hasBody = options.body !== undefined && options.body !== null;
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

  if (hasBody && !isFormData && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && csrfToken) headers.set('X-CSRF-Token', csrfToken);

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      method,
      headers,
      credentials: 'include',
      body: hasBody && !isFormData && typeof options.body !== 'string'
        ? JSON.stringify(options.body)
        : options.body,
    });
  } catch (_error) {
    throw new ApiError(0, { code: 'NETWORK_ERROR', message: 'Сервер недоступен. Проверьте соединение и повторите попытку.' });
  }

  if (!response.ok) {
    const payload = await parseResponse(response).catch(() => null);
    if (response.status === 401) {
      setCsrfToken(null);
      unauthorizedListeners.forEach(listener => listener());
    }
    throw new ApiError(response.status, payload?.error);
  }
  return response;
}

export async function apiRequest(path, options = {}) {
  const response = await request(path, options);
  const payload = await parseResponse(response).catch(() => null);
  if (payload?.meta && payload?.data && typeof payload.data === 'object') return { ...payload.data, meta: payload.meta };
  return payload?.data ?? payload;
}

export async function apiBlobRequest(path, options = {}) {
  const response = await request(path, options);
  return response.blob();
}
