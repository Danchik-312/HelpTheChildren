import { render, screen } from '@testing-library/react';
import StructuredContent from './StructuredContent';

jest.mock('./PrivateMediaPreview', () => ({ media, alt }) => <img data-testid="safe-media" data-media-id={media.id} alt={alt} />);

test('выводит форматированный текст без интерпретации HTML', () => {
  render(<StructuredContent value={{ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '<img src=x onerror=alert(1)>', marks: [{ type: 'bold' }] }] }] }} />);
  expect(screen.getByText('<img src=x onerror=alert(1)>').tagName).toBe('STRONG');
  expect(document.querySelector('img')).not.toBeInTheDocument();
});

test('отбрасывает неизвестные узлы, опасные ссылки и произвольные изображения', () => {
  render(<StructuredContent value={{ type: 'doc', content: [
    { type: 'script', content: [{ type: 'text', text: 'unknown' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'bad link', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] },
    { type: 'image', attrs: { src: 'https://attacker.example/x.png' } },
  ] }} />);
  expect(screen.queryByText('unknown')).not.toBeInTheDocument();
  expect(screen.getByText('bad link').closest('a')).toBeNull();
  expect(screen.queryByTestId('safe-media')).not.toBeInTheDocument();
});

test('рендерит разрешённые ссылки и изображения медиатеки', () => {
  const id = '123e4567-e89b-42d3-a456-426614174000';
  render(<StructuredContent value={{ type: 'doc', content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'Подробнее', marks: [{ type: 'link', attrs: { href: '/help' } }] }] },
    { type: 'image', attrs: { mediaId: id, src: `/api/v1/media/${id}`, alt: 'Описание' } },
  ] }} />);
  expect(screen.getByRole('link', { name: 'Подробнее' })).toHaveAttribute('href', '/help');
  expect(screen.getByTestId('safe-media')).toHaveAttribute('data-media-id', id);
});
