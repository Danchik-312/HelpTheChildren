import { vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { childrenApi, pagesApi, storiesApi } from '../api/contentApi';
import ContentFormPage from './ContentFormPage';

vi.mock('../api/contentApi', () => {
  const api = { list: vi.fn(), get: vi.fn(), preview: vi.fn(), create: vi.fn(), update: vi.fn(), publish: vi.fn(), unpublish: vi.fn(), archive: vi.fn() };
  return { storiesApi: { ...api }, projectsApi: { ...api }, pagesApi: { ...api }, childrenApi: { ...api } };
});
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ canPublish: () => true, user: { role: 'ADMIN' } }) }));
vi.mock('../components/RichTextEditor', () => ({ default: ({ value, onChange }) => <div><span>{value.content?.[0]?.content?.[0]?.text}</span><button type="button" onClick={() => onChange({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Новый текст' }] }] })}>Изменить текст</button></div> }));
vi.mock('../components/MediaPicker', () => ({ default: () => null }));
vi.mock('../components/PrivateMediaPreview', () => ({ default: () => null }));
vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => vi.fn(),
  useParams: () => ({ id: 'story-1' }),
}));

const story = {
  id: 'story-1', title: 'История', slug: 'istoriya', excerpt: 'Кратко',
  body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Старый текст' }] }] },
  coverMediaId: null, coverMedia: null, status: 'DRAFT', version: 3, consentConfirmedAt: null,
};

test('сохраняет изменённую историю с актуальной version и структурированным body', async () => {
  storiesApi.get.mockResolvedValue(story);
  storiesApi.update.mockImplementation((_id, payload) => Promise.resolve({ ...story, ...payload, version: 4 }));
  render(<ContentFormPage resource="stories" />);
  expect(await screen.findByText('Старый текст')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Изменить текст' }));
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить черновик' }));
  await waitFor(() => expect(storiesApi.update).toHaveBeenCalledWith('story-1', expect.objectContaining({
    version: 3,
    body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Новый текст' }] }] },
  })));
});

test('форма карточки ребёнка не показывает удалённый блок согласия', async () => {
  childrenApi.get.mockResolvedValue({
    id: 'story-1', slug: 'child', publicDisplayName: 'Имя', title: 'Карточка', summary: 'Описание',
    storyBody: { type: 'doc', content: [] }, supportReason: 'Причина', coverMediaId: null,
    coverMedia: null, status: 'DRAFT', version: 1,
  });
  render(<ContentFormPage resource="children" />);

  expect(await screen.findByDisplayValue('Карточка')).toBeInTheDocument();
  expect(screen.queryByText('Приватность и согласие')).not.toBeInTheDocument();
  expect(screen.queryByText('Код/ссылка на документ')).not.toBeInTheDocument();
});

test('сохраняет черновик карточки после очистки дополнительных полей', async () => {
  const child = { id: 'story-1', slug: 'child', title: 'Карточка', publicDisplayName: 'Имя', summary: 'Описание',
    storyBody: { type: 'doc', content: [] }, supportReason: 'Причина', status: 'DRAFT', version: 1 };
  childrenApi.get.mockResolvedValue(child);
  childrenApi.update.mockImplementation((_id, payload) => Promise.resolve({ ...child, ...payload, version: 2 }));
  render(<ContentFormPage resource="children" />);
  for (const label of ['Публичное имя', 'Краткое описание', 'Причина поддержки']) {
    const input = await screen.findByLabelText(label);
    expect(input).not.toBeRequired();
    fireEvent.change(input, { target: { value: '' } });
  }
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить черновик' }));
  await waitFor(() => expect(childrenApi.update).toHaveBeenCalledWith('story-1', expect.objectContaining({
    publicDisplayName: '', summary: '', supportReason: '', version: 1,
  })));
});

test('shows the specific validation error for the information page slug', async () => {
  pagesApi.get.mockResolvedValue({ ...story, group: 'GENERAL', description: '', sortOrder: 0 });
  pagesApi.update.mockRejectedValue({
    code: 'VALIDATION_ERROR', message: 'Проверьте заполненные поля.',
    fields: { slug: 'Используйте латинские буквы, цифры и дефисы между частями slug.' },
  });
  render(<ContentFormPage resource="pages" />);
  fireEvent.change(await screen.findByLabelText('Slug'), { target: { value: 'о-фонде' } });
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить черновик' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Slug — Используйте латинские буквы');
});
