import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mediaId = '123e4567-e89b-42d3-a456-426614174000';

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('VITE_API_URL', 'https://api.example.test/api/v1/');
  vi.stubEnv('VITE_MEDIA_BASE_URL', 'https://cdn.example.test/media/');
  vi.stubEnv('VITE_ALLOWED_VIDEO_HOSTS', 'video.example.test');
});

test('uses Vite API/media configuration while preserving media origin and video allowlists', async () => {
  const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ data: { items: [] } }) });
  const { contentRepository, publicMediaUrl } = await import('./contentRepository');
  await contentRepository.list('children');
  expect(fetchMock).toHaveBeenCalledWith('https://api.example.test/api/v1/public/children', { headers: { Accept: 'application/json' } });
  expect(publicMediaUrl(`https://cdn.example.test/media/${mediaId}`)).toBe(`https://cdn.example.test/media/${mediaId}`);
  expect(publicMediaUrl(`https://api.example.test/media/${mediaId}`)).toBeUndefined();
  expect(publicMediaUrl(`https://cdn.example.test/media/${mediaId}?download=1`)).toBeUndefined();
  expect(publicMediaUrl('https://video.example.test/watch', 'EXTERNAL_VIDEO')).toBe('https://video.example.test/watch');
  expect(publicMediaUrl('https://youtube.com/watch', 'EXTERNAL_VIDEO')).toBeUndefined();
});

test('structured media uses the same configured Vite API base', async () => {
  const { default: StructuredContent } = await import('../components/StructuredContent/StructuredContent');
  render(<StructuredContent content={{ type: 'doc', content: [{ type: 'image', attrs: { mediaId, alt: 'Configured image' } }] }} />);
  expect(screen.getByRole('img', { name: 'Configured image' })).toHaveAttribute('src', `https://api.example.test/api/v1/public/media/${mediaId}`);
});
