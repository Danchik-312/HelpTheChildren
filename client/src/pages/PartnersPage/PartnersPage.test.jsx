import { fireEvent, render, screen, within } from '@testing-library/react';
import { vi } from 'vitest';
import PartnersPage from './PartnersPage';
import { contentRepository } from '../../services/contentRepository';

vi.mock('../../hooks/useReducedMotion', () => ({ default: () => true }));

const heading = text => ({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] });
const image = mediaId => ({ type: 'image', attrs: { mediaId } });
const logoId = '12345678-1234-4567-8123-123456789012';

beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
afterEach(() => vi.unstubAllGlobals());

test('loads the published partners page and splits logos from text-only entries', async () => {
  fetch.mockResolvedValue({ ok: true, json: async () => ({ data: {
    id: 'partners',
    title: 'Партнёры фонда',
    body: { type: 'doc', content: [
      image('22345678-1234-4567-8123-123456789012'),
      heading('Партнёр с логотипом'), image(logoId),
      heading('Партнёр без логотипа'),
      heading('Партнёр с недопустимым изображением'), image('https://example.test/unverified.png'),
    ] },
  } }) });
  const { container } = render(<PartnersPage />);
  expect(screen.getByText('Загружаем материалы…')).toBeInTheDocument();
  expect(await screen.findByRole('heading', { name: 'Партнёры фонда' })).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/public/pages/GENERAL/partners'), expect.any(Object));

  const logos = screen.getByRole('list', { name: 'Партнёры с логотипами' });
  expect(within(logos).getAllByRole('listitem')).toHaveLength(1);
  expect(logos).toHaveTextContent('Партнёр с логотипом');
  expect(container.querySelectorAll('img')).toHaveLength(1);
  const logo = logos.querySelector('img');
  expect(logo).toHaveAttribute('src', expect.stringContaining('/public/media/' + logoId));
  const others = screen.getByRole('region', { name: 'Другие партнёры' });
  expect(others).toHaveTextContent('Партнёр без логотипа');
  expect(others).toHaveTextContent('Партнёр с недопустимым изображением');

  fireEvent.error(logo);
  expect(screen.queryByRole('list', { name: 'Партнёры с логотипами' })).not.toBeInTheDocument();
  expect(others).toHaveTextContent('Партнёр с логотипом');
});

test('shows an empty state when the CMS page is unpublished', async () => {
  fetch.mockResolvedValue({ ok: false, status: 404 });
  render(<PartnersPage />);
  expect(await screen.findByText('Список партнёров пока не опубликован.')).toBeInTheDocument();
});

test('shows an error when the CMS request fails', async () => {
  fetch.mockRejectedValue(new Error('offline'));
  render(<PartnersPage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось загрузить материалы');
});

test('uses the canonical partners route in search, navigation and information lists', async () => {
  fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ data: { items: [{ title: 'Партнёры', url: '/partners' }] } }) });
  await expect(contentRepository.search('партнёры')).resolves.toMatchObject([{ to: '/partners' }]);
  fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ data: { items: [{ label: 'Партнёры', url: '/partners' }] } }) });
  await expect(contentRepository.navigation()).resolves.toMatchObject([{ to: '/partners' }]);
  fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ data: { items: [{ title: 'Партнёры', slug: 'partners' }] } }) });
  await expect(contentRepository.list('generalPages')).resolves.toMatchObject([{ to: '/partners' }]);
});
