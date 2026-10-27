import { render, screen } from '@testing-library/react';
import DashboardPage from './DashboardPage';
import { apiRequest } from '../api/apiClient';
import { useAuth } from '../auth/AuthContext';

jest.mock('../api/apiClient', () => ({ apiRequest: jest.fn() }));
jest.mock('../auth/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('react-router-dom', () => ({ Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a> }));

test('показывает статистику, полученную от API, без подстановки значений', async () => {
  useAuth.mockReturnValue({ hasArea: () => true });
  apiRequest.mockResolvedValue({
    counts: { published: 12, drafts: 3, children: 8, projects: 2 },
    recentChanges: [],
    recentPublished: [],
  });
  render(<DashboardPage />);
  expect(await screen.findByText('12')).toBeInTheDocument();
  expect(screen.getByText('3')).toBeInTheDocument();
  expect(screen.getByText('8')).toBeInTheDocument();
  expect(screen.getByText('2')).toBeInTheDocument();
  expect(screen.getByText('Изменений пока нет.')).toBeInTheDocument();
});
