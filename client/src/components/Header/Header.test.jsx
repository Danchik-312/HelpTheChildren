import { vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Header from './Header';
import { contentRepository } from '../../services/contentRepository';

vi.mock('react-router-dom', () => ({ Link: ({ children, to, onClick, ...props }) => <a href={to} {...props} onClick={event => { event.preventDefault(); onClick?.(event); }}>{children}</a> }));
vi.mock('../../services/contentRepository', () => ({ contentRepository: {
  navigation: vi.fn(),
  search: vi.fn(),
} }));

beforeEach(() => {
  contentRepository.navigation.mockReset().mockResolvedValue([{ title: 'Дети', to: '/children' }]);
  contentRepository.search.mockReset().mockResolvedValue([]);
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
});
afterEach(() => vi.unstubAllGlobals());

test('keeps the brand and a single menu trigger without a separate search button', async () => {
  render(<Header />);
  const brand = screen.getByRole('link', { name: 'Help The Children SKD, главная' });
  expect(brand).toHaveTextContent('Помощь детям');
  expect(brand).toHaveTextContent('Help The Children');
  expect(brand).toHaveTextContent('Балдарга жардам');
  expect(screen.getByRole('button', { name: 'Открыть меню' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Поиск по разделам' })).not.toBeInTheDocument();
  expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Помочь' })).toHaveAttribute('href', '/give-help');
  await waitFor(() => expect(contentRepository.navigation).toHaveBeenCalledTimes(1));
});

test('opens navigation with search already available and focuses it on desktop', async () => {
  render(<Header />);
  fireEvent.click(screen.getByRole('button', { name: 'Открыть меню' }));
  expect(screen.getByRole('searchbox', { name: 'Найти раздел или материал' })).toHaveFocus();
  expect(await screen.findByRole('link', { name: 'Дети' })).toHaveAttribute('href', '/children');
  expect(screen.getByRole('navigation', { name: 'Основная навигация' })).toBeInTheDocument();
  expect(contentRepository.search).not.toHaveBeenCalled();
});

test('closes menu with Escape, restores trigger focus and releases page scrolling', async () => {
  render(<Header />);
  const menu = screen.getByRole('button', { name: 'Открыть меню' });
  fireEvent.click(menu);
  expect(menu).toHaveAttribute('aria-expanded', 'true');
  await screen.findByRole('link', { name: 'Дети' });
  expect(document.body.style.overflow).toBe('hidden');
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(menu).toHaveAttribute('aria-expanded', 'false');
  expect(menu).toHaveFocus();
  expect(document.body.style.overflow).toBe('');
});

test('searches from the menu, restores navigation after clearing and reports empty results', async () => {
  contentRepository.search.mockImplementation(async query => query === 'дети'
    ? [{ title: 'Карточки помощи', to: '/children' }]
    : []);
  render(<Header />);
  fireEvent.click(screen.getByRole('button', { name: 'Открыть меню' }));
  const input = screen.getByRole('searchbox', { name: 'Найти раздел или материал' });
  fireEvent.change(input, { target: { value: '  дети  ' } });
  expect(await screen.findByRole('link', { name: 'Карточки помощи' })).toHaveAttribute('href', '/children');
  expect(contentRepository.search).toHaveBeenCalledWith('дети');
  expect(screen.getByRole('navigation', { name: 'Результаты поиска' })).toBeInTheDocument();
  fireEvent.change(input, { target: { value: '   ' } });
  expect(screen.getByRole('navigation', { name: 'Основная навигация' })).toBeInTheDocument();
  expect(await screen.findByRole('link', { name: 'Дети' })).toBeInTheDocument();
  expect(contentRepository.search).toHaveBeenCalledTimes(1);
  fireEvent.change(input, { target: { value: 'нет совпадений' } });
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Ничего не найдено'));
});

test('does not focus the search field automatically on touch or mobile layouts', async () => {
  window.matchMedia.mockReturnValue({ matches: false });
  render(<Header />);
  const menu = screen.getByRole('button', { name: 'Открыть меню' });
  menu.focus();
  fireEvent.click(menu);
  expect(screen.getByRole('searchbox')).not.toHaveFocus();
  expect(menu).toHaveFocus();
  await screen.findByRole('link', { name: 'Дети' });
});

test('closes on backdrop and navigation links and resets the query when reopened', async () => {
  contentRepository.search.mockResolvedValue([{ title: 'Результат', to: '/children' }]);
  render(<Header />);
  const menu = screen.getByRole('button', { name: 'Открыть меню' });
  fireEvent.click(menu);
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'пример' } });
  await screen.findByRole('link', { name: 'Результат' });
  fireEvent.click(screen.getByRole('button', { name: 'Закрыть открытую панель' }));
  expect(menu).toHaveAttribute('aria-expanded', 'false');
  expect(menu).toHaveFocus();
  expect(document.body.style.overflow).toBe('');
  fireEvent.click(menu);
  expect(screen.getByRole('searchbox')).toHaveValue('');
  fireEvent.click(await screen.findByRole('link', { name: 'Дети' }));
  expect(menu).toHaveAttribute('aria-expanded', 'false');
  expect(document.body.style.overflow).toBe('');
});

test('wraps keyboard focus between the menu trigger and the last panel link', async () => {
  render(<Header />);
  const menu = screen.getByRole('button', { name: 'Открыть меню' });
  fireEvent.click(menu);
  const lastLink = await screen.findByRole('link', { name: 'Дети' });
  lastLink.focus();
  fireEvent.keyDown(lastLink, { key: 'Tab' });
  expect(menu).toHaveFocus();
  fireEvent.keyDown(menu, { key: 'Tab', shiftKey: true });
  expect(lastLink).toHaveFocus();
});

test('ignores a stale search response after the query has changed', async () => {
  let resolvePrevious;
  contentRepository.search.mockImplementation(query => query === 'первый'
    ? new Promise(resolve => { resolvePrevious = resolve; })
    : Promise.resolve([{ title: 'Актуальный результат', to: '/children' }]));
  render(<Header />);
  fireEvent.click(screen.getByRole('button', { name: 'Открыть меню' }));
  const input = screen.getByRole('searchbox');
  fireEvent.change(input, { target: { value: 'первый' } });
  expect(screen.getByRole('status')).toHaveTextContent('Ищем материалы');
  fireEvent.change(input, { target: { value: 'второй' } });
  await screen.findByRole('link', { name: 'Актуальный результат' });
  await act(async () => { resolvePrevious([{ title: 'Устаревший результат', to: '/stories' }]); });
  expect(screen.queryByRole('link', { name: 'Устаревший результат' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Актуальный результат' })).toBeInTheDocument();
});

test('reports a failed search separately from an empty result', async () => {
  contentRepository.search.mockRejectedValue(new Error('unavailable'));
  render(<Header />);
  fireEvent.click(screen.getByRole('button', { name: 'Открыть меню' }));
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'пример' } });
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Не удалось выполнить поиск'));
  expect(screen.queryByText(/Ничего не найдено/)).not.toBeInTheDocument();
});
