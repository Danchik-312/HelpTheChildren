import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PublicationFormPage from './PublicationFormPage';
import { categoriesApi, publicationsApi } from '../api/contentApi';

jest.mock('../api/contentApi', () => ({ publicationsApi: { get: jest.fn(), create: jest.fn(), update: jest.fn(), publish: jest.fn(), unpublish: jest.fn() }, categoriesApi: { list: jest.fn() } }));
jest.mock('../auth/AuthContext', () => ({ useAuth: () => ({ canPublish: () => false }) }));
jest.mock('../components/RichTextEditor', () => () => <div>Редактор содержимого</div>);
jest.mock('../components/MediaPicker', () => () => null);
jest.mock('../components/PrivateMediaPreview', () => () => null);
jest.mock('react-router-dom', () => ({
  Link: ({ to, children }) => <a href={to}>{children}</a>,
  useNavigate: () => jest.fn(),
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
