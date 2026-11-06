import { vi } from 'vitest';
import { render } from '@testing-library/react';
import { useSite } from '../hooks/useContent';
import SiteTheme from './SiteTheme';

vi.mock('../hooks/useContent', () => ({ useSite: vi.fn() }));

test('applies stored colors with accessible foregrounds and restores defaults on unmount', () => {
  useSite.mockReturnValue({ data: { organization: { brandColor: '#141414', accentColor: '#FFFFE0' } } });
  const { unmount } = render(<SiteTheme />);
  const style = document.documentElement.style;
  expect(style.getPropertyValue('--color-brand-orange')).toBe('#141414');
  expect(style.getPropertyValue('--color-on-brand-orange')).toBe('#FFFFFF');
  expect(style.getPropertyValue('--brand-icon-invert')).toBe('1');
  expect(style.getPropertyValue('--color-accent')).toBe('#FFFFE0');
  expect(style.getPropertyValue('--color-on-accent')).toBe('#231B16');
  unmount();
  expect(style.getPropertyValue('--color-accent')).toBe('');
  expect(style.getPropertyValue('--color-brand-orange')).toBe('');
});

test('keeps CSS defaults when settings are missing or malformed', () => {
  useSite.mockReturnValue({ data: { organization: { brandColor: 'url(example.test)', accentColor: ['#123456'] } } });
  render(<SiteTheme />);
  expect(document.documentElement.style.getPropertyValue('--color-brand-orange')).toBe('');
  expect(document.documentElement.style.getPropertyValue('--color-accent')).toBe('');
});
