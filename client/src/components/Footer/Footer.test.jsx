import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Footer from './Footer';
import { useSite } from '../../hooks/useContent';

vi.mock('react-router-dom', () => ({ Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a> }));
vi.mock('../../hooks/useContent', () => ({ useSite: vi.fn() }));
const site = {
  organization: { displayName: 'Help The Children' },
  contacts: [
    { id: 'phone', type: 'PHONE', label: 'Телефон', value: '+996 555 000 000', href: 'tel:+996555000000' },
    { id: 'address', type: 'ADDRESS', label: 'Адрес', value: 'Бишкек, улица Примерная, 1', href: null },
  ],
};
beforeEach(() => useSite.mockReturnValue({ data: site }));

test('footer preserves CMS contacts, lazy map and full-container copyright', () => {
  render(<Footer />);
  expect(screen.getByRole('link', { name: '+996 555 000 000' })).toHaveAttribute('href', 'tel:+996555000000');
  expect(screen.getByText('Бишкек, улица Примерная, 1')).toBeInTheDocument();
  const map = screen.getByTitle('Офис Help The Children: Бишкек, улица Примерная, 1');
  expect(map).toHaveAttribute('loading', 'lazy');
  expect(map).toHaveAttribute('src', expect.stringContaining('output=embed'));
  expect(screen.queryByRole('navigation', { name: 'Навигация в подвале' })).not.toBeInTheDocument();
  const copyright = screen.getByText(new RegExp(`© ${new Date().getFullYear()} Help The Children`));
  expect(copyright.parentElement.parentElement).toBe(screen.getByRole('contentinfo'));
  expect(copyright.parentElement).toContainElement(map);
  expect(map.parentElement).not.toContainElement(copyright);
});

test('shows an address fallback without losing available contacts', () => {
  useSite.mockReturnValue({ data: { ...site, contacts: site.contacts.filter(contact => contact.type !== 'ADDRESS') } });
  const { container } = render(<Footer />);
  expect(container.querySelector('iframe')).toBeNull();
  expect(screen.getByText('Адрес офиса пока не опубликован.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '+996 555 000 000' })).toBeInTheDocument();
});
