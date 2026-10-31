import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import Footer from './Footer';

jest.mock('react-router-dom', () => ({ Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a> }));
jest.mock('../../hooks/useContent', () => ({ useSite: () => ({ data: {
  organization: { displayName: 'Help The Children' },
  contacts: [
    { id: 'phone', type: 'PHONE', label: 'Телефон', value: '+996 555 000 000', href: 'tel:+996555000000' },
    { id: 'address', type: 'ADDRESS', label: 'Адрес', value: 'Бишкек, улица Примерная, 1', href: null },
  ],
} }) }));

test('footer renders CMS contacts and a lazy map without navigation', () => {
  render(<Footer />);

  expect(screen.getByRole('link', { name: '+996 555 000 000' })).toHaveAttribute('href', 'tel:+996555000000');
  expect(screen.getByText('Бишкек, улица Примерная, 1')).toBeInTheDocument();
  const map = screen.getByTitle('Офис Help The Children: Бишкек, улица Примерная, 1');
  expect(map).toHaveAttribute('loading', 'lazy');
  expect(map).toHaveAttribute('src', expect.stringContaining('output=embed'));
  expect(screen.queryByRole('navigation', { name: 'Навигация в подвале' })).not.toBeInTheDocument();
  expect(screen.getByText(new RegExp(`© ${new Date().getFullYear()} Help The Children`))).toBeInTheDocument();
});
