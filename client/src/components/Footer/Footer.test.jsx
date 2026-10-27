import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import Footer from './Footer';
import { contentRepository } from '../../services/contentRepository';

jest.mock('react-router-dom', () => ({ Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a> }));
jest.mock('../../services/contentRepository', () => ({ contentRepository: { navigation: jest.fn() } }));
jest.mock('../../hooks/useContent', () => ({ useSite: () => ({ data: { organization: {
  displayName: 'Help The Children',
  legalName: 'Скрываемое юридическое название',
  description: 'Скрываемое описание',
} } }) }));

test('footer keeps navigation and copyright without organization/contact details', async () => {
  contentRepository.navigation.mockResolvedValue([{ to: '/who-we', title: 'О нас' }]);
  render(<Footer />);

  expect(await screen.findByRole('link', { name: 'О нас' })).toHaveAttribute('href', '/who-we');
  expect(screen.getByText(new RegExp(`© ${new Date().getFullYear()} Help The Children`))).toBeInTheDocument();
  expect(screen.queryByText('Скрываемое юридическое название')).not.toBeInTheDocument();
  expect(screen.queryByText('Скрываемое описание')).not.toBeInTheDocument();
  expect(screen.queryByText('Контакты')).not.toBeInTheDocument();
  await waitFor(() => expect(contentRepository.navigation).toHaveBeenCalledTimes(1));
});
