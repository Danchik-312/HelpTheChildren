import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import ContentDetailPage from './ContentDetailPage';

vi.mock('../../hooks/useReducedMotion', () => ({ default: () => true }));

const coverId = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';
const mediaUrl = id => '/api/v1/public/media/' + id;

function renderDetail({ collection = 'publications', sidePhotos, hasCover = true } = {}) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      data: {
        id: 'p1', slug: 'material', kind: 'ARTICLE', title: 'Материал', excerpt: 'Краткое описание',
        coverMedia: hasCover ? { kind: 'IMAGE', url: mediaUrl(coverId), alt: 'Обложка' } : null,
        body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Текст статьи' }] }] },
        sidePhotos,
      },
    }),
  }));
  render(<MemoryRouter initialEntries={['/' + collection + '/material']}>
    <Routes>
      <Route path={'/' + collection + '/:slug'} element={<ContentDetailPage collection={collection} backTo="/publications" backLabel="К публикациям" />} />
    </Routes>
  </MemoryRouter>);
}

afterEach(() => vi.unstubAllGlobals());

test('renders permitted gallery photos in order and displays a shared cover only once', async () => {
  renderDetail({ sidePhotos: [
    { mediaId: otherId, url: mediaUrl(otherId), altText: 'Вторая фотография', caption: 'Подпись' },
    { mediaId: coverId, url: mediaUrl(coverId), altText: 'Фото из галереи' },
    { mediaId: 'unsafe', url: 'https://untrusted.example' + mediaUrl(otherId), altText: 'Запрещённое фото' },
  ] });

  const gallery = await screen.findByRole('complementary', { name: 'Фотографии материала' });
  expect(within(gallery).getAllByRole('img').map(image => image.alt)).toEqual(['Вторая фотография', 'Фото из галереи']);
  expect(within(gallery).getByAltText('Вторая фотография')).toHaveAttribute('loading', 'lazy');
  expect(within(gallery).getByText('Подпись')).toBeInTheDocument();
  expect(screen.queryByAltText('Обложка')).not.toBeInTheDocument();
  expect(screen.queryByAltText('Запрещённое фото')).not.toBeInTheDocument();
  expect(screen.getByText('Текст статьи')).toBeInTheDocument();
});

test.each(['publications', 'children', 'stories'])('moves the %s cover into the article beside the content', async collection => {
  renderDetail({ collection });
  const cover = await screen.findByAltText('Обложка');
  const article = screen.getByRole('article');
  expect(within(article).getByRole('complementary', { name: 'Фотографии материала' })).toContainElement(cover);
  expect(within(article).getByText('Текст статьи')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Материал' }).closest('section')).not.toContainElement(cover);
});

test('omits the gallery when no media is available', async () => {
  renderDetail({ hasCover: false });
  expect(await screen.findByText('Текст статьи')).toBeInTheDocument();
  expect(screen.queryByRole('complementary', { name: 'Фотографии материала' })).not.toBeInTheDocument();
});
