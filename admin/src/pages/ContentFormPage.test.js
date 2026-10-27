import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { childrenApi, storiesApi } from '../api/contentApi';
import ContentFormPage from './ContentFormPage';

jest.mock('../api/contentApi', () => {
  const api = { list: jest.fn(), get: jest.fn(), preview: jest.fn(), create: jest.fn(), update: jest.fn(), publish: jest.fn(), unpublish: jest.fn(), archive: jest.fn() };
  return { storiesApi: { ...api }, projectsApi: { ...api }, pagesApi: { ...api }, childrenApi: { ...api } };
});
jest.mock('../auth/AuthContext', () => ({ useAuth: () => ({ canPublish: () => true, user: { role: 'ADMIN' } }) }));
jest.mock('../components/RichTextEditor', () => ({ value, onChange }) => <div><span>{value.content?.[0]?.content?.[0]?.text}</span><button type="button" onClick={() => onChange({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Новый текст' }] }] })}>Изменить текст</button></div>);
jest.mock('../components/MediaPicker', () => () => null);
jest.mock('../components/PrivateMediaPreview', () => () => null);
jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => jest.fn(),
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
