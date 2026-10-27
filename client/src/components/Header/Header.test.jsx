import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import Header from './Header';
import { contentRepository } from '../../services/contentRepository';

jest.mock('react-router-dom', () => ({ Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a> }));
jest.mock('../../services/contentRepository', () => ({ contentRepository: {
  navigation: jest.fn(),
  search: jest.fn(),
} }));

beforeEach(() => {
  contentRepository.navigation.mockResolvedValue([]);
  contentRepository.search.mockResolvedValue([]);
});

test('shows the organization name beside the logo and keeps header controls accessible', async () => {
  render(<Header />);

  expect(screen.getByRole('link', { name: 'Help The Children SKD, главная' })).toHaveTextContent('Help The Children');
  expect(screen.getByRole('button', { name: 'Открыть меню' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Поиск по разделам' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Помочь' })).toHaveAttribute('href', '/give-help');
  await waitFor(() => expect(contentRepository.navigation).toHaveBeenCalledTimes(1));
});
