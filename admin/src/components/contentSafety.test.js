import { safeImageAttrs, safeLinkHref } from './contentSafety';

test('разрешает только безопасные ссылки', () => {
  expect(safeLinkHref('/about')).toBe('/about');
  expect(safeLinkHref('https://example.org/a')).toBe('https://example.org/a');
  expect(safeLinkHref('mailto:help@example.org')).toBe('mailto:help@example.org');
  expect(safeLinkHref('http://example.org')).toBeNull();
  expect(safeLinkHref('tel:+123456789')).toBeNull();
  expect(safeLinkHref('javascript:alert(1)')).toBeNull();
  expect(safeLinkHref('//attacker.example/path')).toBeNull();
  expect(safeLinkHref('/\\attacker.example/path')).toBeNull();
});

test('принимает изображение только с согласованным media id и URL', () => {
  const id = '123e4567-e89b-42d3-a456-426614174000';
  expect(safeImageAttrs({ mediaId: id, alt: 'Фото', title: null })).toMatchObject({ mediaId: id, alt: 'Фото' });
  expect(safeImageAttrs({ mediaId: id, src: 'https://attacker.example/x' })).toBeNull();
});
