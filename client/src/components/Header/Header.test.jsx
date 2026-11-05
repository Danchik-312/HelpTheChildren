import { vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Header from './Header';
import { contentRepository } from '../../services/contentRepository';

vi.mock('react-router-dom', () => ({ Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a> }));
vi.mock('../../services/contentRepository', () => ({ contentRepository: {
  navigation: vi.fn(),
  search: vi.fn(),
} }));

beforeEach(() => {
  contentRepository.navigation.mockReset().mockResolvedValue([{ title: 'Дети', to: '/children' }]);
  contentRepository.search.mockReset().mockResolvedValue([]);
});

test('shows the organization name beside the logo and keeps header controls accessible', async () => {
  render(<Header />);
  const brand = screen.getByRole('link', { name: 'Help The Children SKD, главная' });
  expect(brand).toHaveTextContent('Помощь детям');
  expect(brand).toHaveTextContent('Help The Children');
  expect(brand).toHaveTextContent('Балдарга жардам');
  expect(screen.getByRole('button', { name: 'Открыть меню' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Поиск по разделам' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Помочь' })).toHaveAttribute('href', '/give-help');
  await waitFor(() => expect(contentRepository.navigation).toHaveBeenCalledTimes(1));
});

test('closes menu with Escape, restores trigger focus and releases page scrolling', async () => {
  render(<Header />);
  await waitFor(() => expect(contentRepository.navigation).toHaveBeenCalledTimes(1));
  const menu = screen.getByRole('button', { name: 'Открыть меню' });
  fireEvent.click(menu);
  expect(menu).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('link', { name: 'Дети' })).toHaveAttribute('href', '/children');
  expect(document.body.style.overflow).toBe('hidden');
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(menu).toHaveAttribute('aria-expanded', 'false');
  expect(menu).toHaveFocus();
  expect(document.body.style.overflow).toBe('');
});

test('searches public content, handles empty results and restores focus after Escape', async () => {
  contentRepository.search.mockImplementation(async query => query === 'дети'
    ? [{ title: 'Карточки помощи', to: '/children' }]
    : []);
  render(<Header />);
  const search = screen.getByRole('button', { name: 'Поиск по разделам' });
  fireEvent.click(search);
  const input = screen.getByRole('searchbox', { name: 'Найти раздел или материал' });
  expect(input).toHaveFocus();
  fireEvent.change(input, { target: { value: 'дети' } });
  expect(await screen.findByRole('link', { name: 'Карточки помощи' })).toHaveAttribute('href', '/children');
  fireEvent.change(input, { target: { value: 'нет совпадений' } });
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Ничего не найдено'));
  fireEvent.keyDown(input, { key: 'Escape' });
  expect(search).toHaveAttribute('aria-expanded', 'false');
  expect(search).toHaveFocus();
  expect(document.body.style.overflow).toBe('');
});
