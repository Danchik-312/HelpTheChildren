import { vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import Hero from './Hero';

const state = vi.hoisted(() => ({ slides: [], reducedMotion: false }));
vi.mock('react-router-dom', () => ({ Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a> }));
vi.mock('../../assets/icons/next.svg', () => ({ ReactComponent: () => <span aria-hidden="true" /> }));
vi.mock('../../hooks/useInView', () => ({ default: () => ({ ref: { current: null }, isInView: true }) }));
vi.mock('../../hooks/useReducedMotion', () => ({ default: () => state.reducedMotion }));
vi.mock('../../hooks/useContent', () => ({ useCollection: () => ({ data: state.slides, loading: false, error: null }) }));

const slide = (id, kind = 'IMAGE', url = `http://localhost/${id}`) => ({
  id, title: id, description: `Описание ${id}`, altText: `Медиа ${id}`,
  isDecorative: false, media: { kind, url }, poster: { url: 'http://localhost/poster' },
});
const advance = milliseconds => act(() => vi.advanceTimersByTime(milliseconds));

beforeEach(() => {
  state.slides = [slide('Видео', 'VIDEO')];
  state.reducedMotion = false;
  vi.useFakeTimers();
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
});
afterEach(() => vi.useRealTimers());

test('renders CMS video with playback attributes, poster and fallback after load error', () => {
  render(<Hero />);
  const video = screen.getByLabelText('Медиа Видео');
  expect(video.tagName).toBe('VIDEO');
  expect(video).toHaveAttribute('poster', 'http://localhost/poster');
  expect(video.autoplay).toBe(true);
  expect(video.muted).toBe(true);
  expect(video.loop).toBe(true);
  expect(video).toHaveAttribute('playsinline');
  fireEvent.error(video);
  expect(screen.getByRole('img', { name: 'Медиа Видео' })).toBeInTheDocument();
});

test('automatically advances image slides after five seconds', () => {
  state.slides = [slide('Первое'), slide('Второе')];
  render(<Hero />);
  advance(4999);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Первое');
  advance(1);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Второе');
});

test.each([
  ['VIDEO', 'http://localhost/video'],
  ['EXTERNAL_VIDEO', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
])('keeps an active %s slide past the image timer until manually changed', (kind, url) => {
  state.slides = [slide('Видео', kind, url), slide('Картинка')];
  const { container } = render(<Hero />);
  const media = container.querySelector(kind === 'VIDEO' ? 'video' : 'iframe');
  expect(media).not.toBeNull();
  advance(16000);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Видео');
  expect(media.isConnected).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Следующий слайд' }));
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Картинка');
  expect(container.querySelector(kind === 'VIDEO' ? 'video' : 'iframe')).toBeNull();
});

test('does not duplicate or restart the only slide when time passes or controls are used', () => {
  const { container } = render(<Hero />);
  const video = container.querySelector('video');
  advance(16000);
  for (const name of ['Предыдущий слайд', 'Следующий слайд']) {
    const button = screen.queryByRole('button', { name });
    if (button) fireEvent.click(button);
  }
  expect(container.querySelectorAll('video')).toHaveLength(1);
  expect(container.querySelector('video')).toBe(video);
});

test('respects reduced motion for automatic image transitions and keeps manual controls', () => {
  state.reducedMotion = true;
  state.slides = [slide('Первое'), slide('Второе')];
  render(<Hero />);
  advance(16000);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Первое');
  fireEvent.click(screen.getByRole('button', { name: 'Следующий слайд' }));
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Второе');
});

test.each([
  ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'www.youtube.com', '/embed/dQw4w9WgXcQ', 'mute'],
  ['https://youtu.be/dQw4w9WgXcQ?unexpected=discard', 'www.youtube.com', '/embed/dQw4w9WgXcQ', 'mute'],
  ['https://vimeo.com/123456789', 'player.vimeo.com', '/video/123456789', 'muted'],
])('normalizes a supported external video without forwarding unrelated parameters: %s', (url, host, path, muteKey) => {
  state.slides = [slide('Внешнее', 'EXTERNAL_VIDEO', url)];
  render(<Hero />);
  const iframe = screen.getByTitle('Медиа Внешнее');
  const source = new URL(iframe.getAttribute('src'));
  expect(source.protocol).toBe('https:');
  expect(source.hostname).toBe(host);
  expect(source.pathname).toBe(path);
  expect(source.searchParams.get('autoplay')).toBe('1');
  expect(source.searchParams.get(muteKey)).toBe('1');
  expect(source.searchParams.get('loop')).toBe('1');
  expect(source.searchParams.has('unexpected')).toBe(false);
  expect(iframe.getAttribute('allow')).toContain('autoplay');
});

test.each(['https://www.youtube.com.evil.example/embed/dQw4w9WgXcQ', 'http://www.youtube.com/embed/dQw4w9WgXcQ'])('never embeds an external source rejected by the real media validator: %s', url => {
  state.slides = [slide('Запрещённое', 'EXTERNAL_VIDEO', url)];
  const { container } = render(<Hero />);
  expect(container.querySelector('iframe')).toBeNull();
  expect(screen.getByRole('img', { name: 'Медиа Запрещённое' })).toBeInTheDocument();
});

test('revalidates the normalized host against a narrowed configured allowlist', async () => {
  vi.stubEnv('VITE_ALLOWED_VIDEO_HOSTS', 'youtu.be');
  vi.resetModules();
  const { default: RestrictedHero } = await import('./Hero');
  state.slides = [slide('Ограниченное', 'EXTERNAL_VIDEO', 'https://youtu.be/dQw4w9WgXcQ')];
  const { container } = render(<RestrictedHero />);
  expect(container.querySelector('iframe')).toBeNull();
  expect(screen.getByRole('img', { name: 'Медиа Ограниченное' })).toBeInTheDocument();
});

test('keeps the active index valid when the CMS slide list shrinks', () => {
  state.reducedMotion = true;
  state.slides = [slide('Первое'), slide('Второе')];
  const { rerender } = render(<Hero />);
  fireEvent.click(screen.getByRole('button', { name: 'Следующий слайд' }));
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Второе');
  state.slides = [slide('Оставшееся')];
  rerender(<Hero />);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Оставшееся');
  expect(screen.getByRole('button', { name: 'Следующий слайд' })).toBeDisabled();
});
