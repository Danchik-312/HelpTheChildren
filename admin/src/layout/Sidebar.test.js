import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Sidebar from './Sidebar';
import { useAuth } from '../auth/AuthContext';

vi.mock('../auth/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('react-router-dom', () => ({
  NavLink: ({ children, to, className, end: _end, ...props }) => <a href={to} className={typeof className === 'function' ? className({ isActive: false }) : className} {...props}>{children}</a>,
  useLocation: () => ({ pathname: '/', search: '' }),
}));

test('редактор видит только разрешённые разделы и не видит управление пользователями', () => {
  useAuth.mockReturnValue({
    user: { role: 'EDITOR' },
    hasArea: area => area === 'PUBLICATIONS',
  });
  render(<Sidebar open={false} onClose={() => {}} />);
  expect(screen.getByRole('link', { name: 'Новости' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Статьи / публикации' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Пользователи и роли' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Медиатека' })).not.toBeInTheDocument();
});

test('ADMIN видит управление категориями, пользователями и все основные области', () => {
  useAuth.mockReturnValue({ user: { role: 'ADMIN' }, hasArea: () => true });
  render(<Sidebar open={false} onClose={() => {}} />);
  expect(screen.getByRole('link', { name: 'Пользователи и роли' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Категории публикаций' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Медиатека' })).toBeInTheDocument();
});
