import { vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { childrenApi, storiesApi } from '../api/contentApi';
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
