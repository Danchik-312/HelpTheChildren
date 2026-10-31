import { contentRepository, publicMediaUrl } from './contentRepository';

const response = data => ({ ok: true, json: async () => ({ data }) });

describe('contentRepository public API integration', () => {
  beforeEach(() => { global.fetch = jest.fn(); });

  test('preserves published structured content for the safe public renderer', async () => {
    global.fetch.mockResolvedValue(response({ items: [{ id: 'p1', slug: 'news', title: 'Новость', kind: 'NEWS', excerpt: 'Коротко', body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Текст статьи' }] }] }, coverMedia: { kind: 'IMAGE', url: '/api/v1/public/media/11111111-1111-4111-8111-111111111111', alt: 'Обложка' } }] }));
    const items = await contentRepository.list('publications');
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/public/publications'), expect.any(Object));
    expect(items[0]).toMatchObject({ title: 'Новость', kind: 'NEWS', kindLabel: 'Новости', category: 'Новости', description: 'Коротко', body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Текст статьи' }] }] }, image: 'http://localhost:4000/api/v1/public/media/11111111-1111-4111-8111-111111111111' });
    expect(items[0].isDemo).toBeUndefined();
  });

  test('maps child public projection without private fields', async () => {
    global.fetch.mockResolvedValue(response({ items: [{ id: 'c1', slug: 'child', title: 'Карточка', publicDisplayName: 'Алия', publicAgeLabel: '8 лет', approvedHealthSummary: 'Нужна операция', supportReason: 'Лечение', summary: 'Краткое описание', storyBody: { type: 'doc', content: [] }, coverMedia: null }] }));
    const items = await contentRepository.list('children');
    expect(items[0]).toMatchObject({ name: 'Алия', title: 'Алия', age: '8 лет', disease: 'Нужна операция', description: 'Краткое описание' });
  });

  test('loads real navigation and search results', async () => {
    global.fetch.mockResolvedValueOnce(response({ items: [{ key: 'about', label: 'О нас', url: '/who-we' }] }));
    await expect(contentRepository.search(' ')).resolves.toEqual([{ title: 'О нас', to: '/who-we' }]);
    global.fetch.mockResolvedValueOnce(response({ items: [{ title: 'История', description: 'Описание', url: '/stories/story' }] }));
    await expect(contentRepository.search('дети & помощь')).resolves.toEqual([{ title: 'История', description: 'Описание', to: '/stories/story' }]);
    expect(new URL(global.fetch.mock.calls[1][0]).searchParams.get('q')).toBe('дети & помощь');
  });

  test('keeps user categories separate and preserves server pagination metadata', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ data: { items: [{ id: 'p1', slug: 'news', title: 'Новость', kind: 'NEWS', excerpt: 'Текст', categories: [{ id: 'c1', slug: 'events', name: 'События' }] }] }, meta: { page: 2, pageSize: 1, total: 3, totalPages: 3 } }) });
    const result = await contentRepository.listPage('publications', { page: 2, pageSize: 1, kind: 'NEWS', categoryId: 'c1' });
    expect(result.meta).toEqual({ page: 2, pageSize: 1, total: 3, totalPages: 3 });
    expect(result.items[0]).toMatchObject({ kindLabel: 'Новости', categoryNames: ['События'] });
    const url = new URL(global.fetch.mock.calls[0][0]);
    expect(url.searchParams.get('categoryId')).toBe('c1');
    expect(url.searchParams.get('page')).toBe('2');
  });

  test('drops search routes that do not exist in the application', async () => {
    global.fetch.mockResolvedValue(response({ items: [
      { title: 'Страница', url: '/general/page' },
      { title: 'Новость', url: '/publications/news' },
      { title: 'Информация', url: '/information/report' },
      { title: 'Проект', url: '/projects/project-one' },
      { title: 'Удалённый раздел', url: '/contacts' },
      { title: 'Несуществующая деталь', url: '/what-we-do/project-one' },
    ] }));
    await expect(contentRepository.search('текст')).resolves.toEqual([
      { title: 'Новость', description: '', to: '/publications/news' },
      { title: 'Информация', description: '', to: '/information/report' },
      { title: 'Проект', description: '', to: '/projects/project-one' },
    ]);
  });

  test('maps CMS hero video, poster and accessible text to safe media URLs', async () => {
    global.fetch.mockResolvedValue(response({ items: [{ id: 'h1', title: 'История', subtitle: 'Описание', altText: 'Видео о проекте', isDecorative: false, media: { kind: 'VIDEO', url: '/api/v1/public/media/22222222-2222-4222-8222-222222222222' }, poster: { kind: 'IMAGE', url: '/api/v1/public/media/33333333-3333-4333-8333-333333333333' } }] }));
    const [slide] = await contentRepository.list('hero');
    expect(slide).toMatchObject({ altText: 'Видео о проекте', media: { kind: 'VIDEO', url: 'http://localhost:4000/api/v1/public/media/22222222-2222-4222-8222-222222222222' }, poster: { url: 'http://localhost:4000/api/v1/public/media/33333333-3333-4333-8333-333333333333' } });
  });

  test('rejects untrusted public media origins and external video hosts', () => {
    expect(publicMediaUrl('https://evil.example/api/v1/public/media/11111111-1111-4111-8111-111111111111', 'IMAGE')).toBeUndefined();
    expect(publicMediaUrl('/api/v1/public/media/not-a-uuid', 'VIDEO')).toBeUndefined();
    expect(publicMediaUrl('https://evil.example/video', 'EXTERNAL_VIDEO')).toBeUndefined();
    expect(publicMediaUrl('https://player.vimeo.com/video/123', 'EXTERNAL_VIDEO')).toBe('https://player.vimeo.com/video/123');
  });

  test('loads public site and ordered homepage settings from CMS', async () => {
    global.fetch.mockResolvedValueOnce(response({ organization: { displayName: 'Организация' }, contacts: [] }));
    await expect(contentRepository.site()).resolves.toMatchObject({ organization: { displayName: 'Организация' } });
    global.fetch.mockResolvedValueOnce(response({ items: [{ key: 'projects', position: 1 }, { key: 'children', position: 2 }] }));
    await expect(contentRepository.homepage()).resolves.toEqual([{ key: 'projects', position: 1 }, { key: 'children', position: 2 }]);
  });

  test('does not use local demo data when public API is unavailable', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });
    await expect(contentRepository.list('stories')).rejects.toThrow('Не удалось загрузить опубликованные данные.');
  });

  test('rejects unsupported collections', async () => {
    await expect(contentRepository.list('not-a-collection')).rejects.toThrow('Unknown content collection: not-a-collection');
  });
});
