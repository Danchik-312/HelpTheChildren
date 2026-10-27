import { render, screen, waitFor } from '@testing-library/react';
import { publicationsApi } from '../api/contentApi';
import PublicationsPage from './PublicationsPage';

jest.mock('../api/contentApi', () => ({ publicationsApi: { list: jest.fn(), publish: jest.fn(), unpublish: jest.fn(), archive: jest.fn() } }));
jest.mock('../auth/AuthContext', () => ({ useAuth: () => ({ canPublish: () => true }) }));
jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
  useSearchParams: () => [new URLSearchParams('kind=NEWS'), jest.fn()],
}));

test('запрашивает реальные новости и показывает пустое состояние', async () => {
  publicationsApi.list.mockResolvedValue({ items: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } });
  render(<PublicationsPage />);
  expect(await screen.findByText('Материалы не найдены')).toBeInTheDocument();
  await waitFor(() => expect(publicationsApi.list).toHaveBeenCalledWith({ kind: 'NEWS', status: '', q: '', page: 1, pageSize: 20 }));
});
