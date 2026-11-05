import { vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { categoriesApi, publicationsApi } from '../api/contentApi';
import PublicationsPage from './PublicationsPage';

vi.mock('../api/contentApi', () => ({ publicationsApi: { list: vi.fn(), publish: vi.fn(), unpublish: vi.fn(), archive: vi.fn() }, categoriesApi: { list: vi.fn() } }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ canPublish: () => true }) }));

test('запрашивает реальные новости и показывает пустое состояние', async () => {
  publicationsApi.list.mockResolvedValue({ items: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } });
  categoriesApi.list.mockResolvedValue({ items: [] });
  render(<MemoryRouter initialEntries={['/publications?kind=NEWS']}><PublicationsPage /></MemoryRouter>);
  expect(await screen.findByText('Материалы не найдены')).toBeInTheDocument();
  await waitFor(() => expect(publicationsApi.list).toHaveBeenCalledWith({ kind: 'NEWS', status: '', q: '', categoryId: '', page: 1, pageSize: 20 }));
});
