import { vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PublicationFormPage from './PublicationFormPage';
import { categoriesApi, publicationsApi } from '../api/contentApi';

vi.mock('../api/contentApi', () => ({ publicationsApi: { get: vi.fn(), create: vi.fn(), update: vi.fn(), publish: vi.fn(), unpublish: vi.fn() }, categoriesApi: { list: vi.fn() } }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ canPublish: () => false }) }));
vi.mock('../components/RichTextEditor', () => ({ default: () => <div>Редактор содержимого</div> }));
vi.mock('../components/MediaPicker', () => ({ default: () => null }));
vi.mock('../components/PrivateMediaPreview', () => ({ default: () => null }));
vi.mock('react-router-dom', () => ({
  Link: ({ to, children }) => <a href={to}>{children}</a>,
  useNavigate: () => vi.fn(),
  useParams: () => ({}),
  useSearchParams: () => [new URLSearchParams('kind=ARTICLE')],
}));

test('создаёт материал как черновик через реальный API и не показывает публикацию без разрешения', async () => {
  categoriesApi.list.mockResolvedValue({ items: [] });
  publicationsApi.create.mockResolvedValue({ id: 'article-1', kind: 'ARTICLE', title: 'Материал', slug: 'material', excerpt: 'Описание', body: { type: 'doc', content: [] }, status: 'DRAFT' });
  render(<PublicationFormPage />);
  fireEvent.change(screen.getByLabelText('Slug'), { target: { value: 'material' } });
  fireEvent.change(screen.getByLabelText('Заголовок'), { target: { value: 'Материал' } });
  fireEvent.change(screen.getByLabelText('Краткое описание'), { target: { value: 'Описание' } });
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить черновик' }));

  await waitFor(() => expect(publicationsApi.create).toHaveBeenCalledWith(expect.objectContaining({
    kind: 'ARTICLE', title: 'Материал', slug: 'material', excerpt: 'Описание',
    body: { type: 'doc', content: [{ type: 'paragraph' }] }, coverMediaId: null,
  })));
  expect(await screen.findByText('Редактор содержимого')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Опубликовать' })).not.toBeInTheDocument();
});
