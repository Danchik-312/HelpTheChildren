import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import StructuredContent from './StructuredContent';

describe('StructuredContent', () => {
  test('renders allowlisted Tiptap blocks, marks and safe links', () => {
    render(<StructuredContent content={{ type: 'doc', content: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Заголовок', marks: [{ type: 'bold' }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Ссылка', marks: [{ type: 'link', attrs: { href: 'https://example.org' } }] }] },
      { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Пункт' }] }] }] },
      { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Цитата' }] }] },
    ] }} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Заголовок' }).querySelector('strong')).toHaveTextContent('Заголовок');
    expect(screen.getByRole('link', { name: 'Ссылка' })).toHaveAttribute('href', 'https://example.org/');
    expect(screen.getByText('Пункт').closest('li')).toBeInTheDocument();
    expect(screen.getByText('Цитата').closest('blockquote')).toBeInTheDocument();
  });

  test('renders inline media via the public media route with alt text and responsive image class', () => {
    const mediaId = 'd9428888-122b-4a3d-9a54-4f4b1f5e39aa';
    const { container } = render(<StructuredContent content={{ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'image', attrs: { mediaId, alt: 'Ребёнок рисует' } }] }] }} />);
    const image = screen.getByRole('img', { name: 'Ребёнок рисует' });
    expect(image).toHaveAttribute('src', `http://localhost:4000/api/v1/public/media/${mediaId}`);
    expect(image.className).toMatch(/image/);
    expect(container.querySelector('[src^="javascript:"]')).toBeNull();
  });

  test('renders links accepted by backend when nullable Tiptap attrs are null', () => {
    render(<StructuredContent content={{ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Ссылка', marks: [{ type: 'link', attrs: { href: '/about', target: null, rel: null, class: null } }] }] }] }} />);
    expect(screen.getByRole('link', { name: 'Ссылка' })).toHaveAttribute('href', '/about');
  });

  test('fails closed for unknown nodes, injected attrs, unsafe links and untrusted image URLs', () => {
    const { container } = render(<StructuredContent content={{ type: 'doc', content: [
      { type: 'paragraph', content: [{ type: 'text', text: '<img src=x onerror=alert(1)>' }] },
      { type: 'paragraph', attrs: { onClick: 'alert(1)' }, content: [{ type: 'text', text: 'Не показывать' }] },
      { type: 'unknownNode', content: [{ type: 'text', text: 'Невозможно' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Опасная ссылка', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] },
      { type: 'image', attrs: { src: 'javascript:alert(1)', alt: 'Не показывать' } },
    ] }} />);
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(container.textContent).not.toContain('Не показывать');
    expect(container.querySelector('a')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });
});
