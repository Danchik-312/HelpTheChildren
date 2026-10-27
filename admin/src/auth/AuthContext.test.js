import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import { apiRequest, setCsrfToken, subscribeUnauthorized } from '../api/apiClient';

jest.mock('../api/apiClient', () => ({
  apiRequest: jest.fn(),
  setCsrfToken: jest.fn(),
  subscribeUnauthorized: jest.fn(),
}));

function AuthControls() {
  const { user, status, login, logout, hasArea, canPublish } = useAuth();
  return <div>
    <span>{status}</span><span>{user?.email || 'нет пользователя'}</span>
    <span>{hasArea('PUBLICATIONS') ? 'area-yes' : 'area-no'}</span>
    <span>{canPublish('PUBLICATIONS') ? 'publish-yes' : 'publish-no'}</span>
    <button onClick={() => login({ email: 'admin@example.test', password: 'secret' })}>Войти</button>
    <button onClick={logout}>Выйти</button>
  </div>;
}

const admin = { id: 'user-1', email: 'admin@example.test', role: 'ADMIN', permissions: [] };

beforeEach(() => {
  apiRequest.mockReset();
  setCsrfToken.mockClear();
  subscribeUnauthorized.mockReset();
  subscribeUnauthorized.mockImplementation(() => () => {});
});

test('восстанавливает реальную сессию и устанавливает CSRF-токен', async () => {
  apiRequest.mockResolvedValue({ user: admin, csrfToken: 'csrf-session' });
  render(<AuthProvider><AuthControls /></AuthProvider>);
  expect(await screen.findByText('authenticated')).toBeInTheDocument();
  expect(screen.getByText(admin.email)).toBeInTheDocument();
  expect(setCsrfToken).toHaveBeenCalledWith('csrf-session');
  expect(apiRequest).toHaveBeenCalledWith('/auth/session');
});

test('вход отправляет credentials на API и применяет роль пользователя', async () => {
  apiRequest.mockRejectedValueOnce(Object.assign(new Error('Нет сессии'), { status: 401 }));
  render(<AuthProvider><AuthControls /></AuthProvider>);
  await screen.findByText('anonymous');
  apiRequest.mockResolvedValueOnce({ user: admin, csrfToken: 'csrf-login' });
  fireEvent.click(screen.getByRole('button', { name: 'Войти' }));
  expect(await screen.findByText(admin.email)).toBeInTheDocument();
  expect(apiRequest).toHaveBeenLastCalledWith('/auth/login', { method: 'POST', body: { email: admin.email, password: 'secret' } });
  expect(screen.getByText('area-yes')).toBeInTheDocument();
  expect(screen.getByText('publish-yes')).toBeInTheDocument();
});

test('401 при восстановлении завершает сессию, а поздний 401 сбрасывает пользователя', async () => {
  let onUnauthorized;
  subscribeUnauthorized.mockImplementation(listener => { onUnauthorized = listener; return () => {}; });
  apiRequest.mockResolvedValueOnce({ user: admin, csrfToken: 'csrf-session' });
  render(<AuthProvider><AuthControls /></AuthProvider>);
  await screen.findByText(admin.email);
  act(() => onUnauthorized());
  await waitFor(() => expect(screen.getByText('anonymous')).toBeInTheDocument());
  expect(screen.getByText('нет пользователя')).toBeInTheDocument();
  expect(setCsrfToken).toHaveBeenLastCalledWith(null);
});

test('истёкшая сессия (401) восстановления остаётся анонимной без ошибки приложения', async () => {
  const unauthorized = Object.assign(new Error('Сессия истекла'), { status: 401 });
  apiRequest.mockRejectedValue(unauthorized);
  render(<AuthProvider><AuthControls /></AuthProvider>);
  expect(await screen.findByText('anonymous')).toBeInTheDocument();
  expect(screen.getByText('нет пользователя')).toBeInTheDocument();
});
