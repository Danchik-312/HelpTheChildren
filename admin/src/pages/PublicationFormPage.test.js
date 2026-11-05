import { vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { categoriesApi, publicationsApi } from '../api/contentApi';
import PublicationFormPage, { normalizeBody, publicationSignature } from './PublicationFormPage';

vi.mock('../api/contentApi', () => ({ publicationsApi: { get: vi.fn(), create: vi.fn(), update: vi.fn(), publish: vi.fn(), unpublish: vi.fn() }, categoriesApi: { list: vi.fn() } }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ canPublish: () => true }) }));
vi.mock('../components/RichTextEditor', () => ({ default: ({ value, onChange }) => <div><span>{value.content?.[0]?.content?.[0]?.text}</span><button type="button" onClick={() => onChange({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Новый текст' }] }] })}>Изменить текст</button></div> }));
vi.mock('../components/MediaPicker', () => ({ default: () => null }));
vi.mock('../components/PrivateMediaPreview', () => ({ default: () => null }));
vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => vi.fn(),
  useParams: () => ({ id: 'publication-1' }),
  useSearchParams: () => [new URLSearchParams('kind=NEWS')],
}));

const publication = {
  id: 'publication-1', kind: 'NEWS', title: 'Новость', slug: 'novost', excerpt: 'Кратко',
  body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Старый текст' }] }] },
  coverMediaId: null, coverMedia: null, status: 'DRAFT', version: 3,
};

beforeEach(() => {
  vi.clearAllMocks();
  categoriesApi.list.mockResolvedValue({ items: [{ id: 'category-1', name: 'Помощь детям', slug: 'help' }] });
});

test('нормализует прежний массив блоков в документ Tiptap', () => {
  expect(normalizeBody([{ type: 'paragraph', text: 'Текст' }])).toEqual({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Текст' }] }] });
});

test('считает эквивалентный JSON Tiptap с другим порядком ключей и пустыми default-полями неизменённым', () => {
  const base = { kind: 'NEWS', title: 'A', slug: 'a', excerpt: 'B', coverMediaId: null, categoryIds: ['b', 'a'] };
  const fromApi = { ...base, body: { type: 'doc', content: [{ type: 'paragraph', attrs: {}, content: [{ type: 'text', marks: [], text: 'Текст' }] }] } };
  const fromEditor = { ...base, categoryIds: ['a', 'b'], body: { content: [{ content: [{ text: 'Текст', type: 'text' }], type: 'paragraph' }], type: 'doc' } };
  expect(publicationSignature(fromApi)).toBe(publicationSignature(fromEditor));
});

test('загружает JSON и сохраняет изменённый черновик через API', async () => {
  publicationsApi.get.mockResolvedValue(publication);
  publicationsApi.update.mockImplementation((_id, payload) => Promise.resolve({ ...publication, ...payload, version: 4 }));
  render(<PublicationFormPage />);
  expect(await screen.findByText('Старый текст')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Изменить текст' }));
  expect(screen.getByText('Есть несохранённые изменения')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить черновик' }));
  await waitFor(() => expect(publicationsApi.update).toHaveBeenCalledWith('publication-1', expect.objectContaining({
    version: 3,
    body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Новый текст' }] }] },
  })));
  await waitFor(() => expect(screen.queryByText('Есть несохранённые изменения')).not.toBeInTheDocument());
});

test('публикует и снимает с публикации через API с актуальной версией', async () => {
  publicationsApi.get.mockResolvedValue(publication);
  publicationsApi.publish.mockResolvedValue({ status: 'PUBLISHED', version: 4 });
  publicationsApi.unpublish.mockResolvedValue({ status: 'DRAFT', version: 5 });
  render(<PublicationFormPage />);
  await screen.findByText('Старый текст');

  fireEvent.click(screen.getByRole('button', { name: 'Опубликовать' }));
  await waitFor(() => expect(publicationsApi.publish).toHaveBeenCalledWith('publication-1', 3));
  await screen.findByRole('button', { name: 'Снять с публикации' });
  fireEvent.click(screen.getByRole('button', { name: 'Снять с публикации' }));
  await waitFor(() => expect(publicationsApi.unpublish).toHaveBeenCalledWith('publication-1', 4));
});

test('после сохранения разрешает публикацию, а после новой правки снова требует сохранение', async () => {
  publicationsApi.get.mockResolvedValue(publication);
  publicationsApi.update
    .mockImplementationOnce((_id, payload) => Promise.resolve({ ...publication, ...payload, version: 4 }))
    .mockImplementationOnce((_id, payload) => Promise.resolve({ ...publication, ...payload, status: 'PUBLISHED', version: 6 }));
  publicationsApi.publish.mockResolvedValue({ status: 'PUBLISHED', version: 5 });
  publicationsApi.unpublish.mockResolvedValue({ status: 'DRAFT', version: 7 });
  render(<PublicationFormPage />);
  await screen.findByText('Старый текст');

  fireEvent.click(screen.getByRole('button', { name: 'Изменить текст' }));
  expect(screen.getByRole('button', { name: 'Опубликовать' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить черновик' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Опубликовать' })).toBeEnabled());

  fireEvent.click(screen.getByRole('button', { name: 'Опубликовать' }));
  await screen.findByRole('button', { name: 'Снять с публикации' });
  fireEvent.change(screen.getByLabelText('Заголовок'), { target: { value: 'Обновлённая новость' } });
  expect(screen.getByRole('button', { name: 'Снять с публикации' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить черновик' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Снять с публикации' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Снять с публикации' }));
  await waitFor(() => expect(publicationsApi.unpublish).toHaveBeenCalledWith('publication-1', 6));
});

test('считает изменение категории несохранённым и отправляет выбранные категории', async () => {
  publicationsApi.get.mockResolvedValue(publication);
  publicationsApi.update.mockImplementation((_id, payload) => Promise.resolve({ ...publication, ...payload, version: 4 }));
  render(<PublicationFormPage />);
  await screen.findByText('Старый текст');
  fireEvent.click(await screen.findByLabelText('Помощь детям'));
  expect(screen.getByText('Есть несохранённые изменения')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить черновик' }));
  await waitFor(() => expect(publicationsApi.update).toHaveBeenCalledWith('publication-1', expect.objectContaining({ categoryIds: ['category-1'] })));
});
