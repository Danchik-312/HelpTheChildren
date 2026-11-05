import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProtectedRoute from './ProtectedRoute';
import { useAuth } from './AuthContext';

vi.mock('./AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('react-router-dom', () => ({
  Navigate: ({ to }) => <p>Переход: {to}</p>,
  Outlet: () => <p>Закрытая страница</p>,
  useLocation: () => ({ pathname: '/private' }),
}));

test('перенаправляет гостя на страницу входа', () => {
  useAuth.mockReturnValue({ status: 'anonymous' });
  render(<ProtectedRoute />);
  expect(screen.getByText('Переход: /login')).toBeInTheDocument();
  expect(screen.queryByText('Закрытая страница')).not.toBeInTheDocument();
});
