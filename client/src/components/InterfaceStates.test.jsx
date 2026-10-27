import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Header from './Header/Header';
import ContentState from './ContentState/ContentState';

jest.mock('react-router/dom', () => {
  const { TextDecoder, TextEncoder } = require('util');
  global.TextDecoder = TextDecoder;
  global.TextEncoder = TextEncoder;
  return require('react-router/dist/development/dom-export.js');
}, { virtual: true });

beforeEach(() => {
  global.fetch = jest.fn(async input => {
    const url = new URL(input);
    const q = url.searchParams.get('q');
    const items = q === 'прозрачной' ? [{ title: 'Принципы прозрачной помощи', description: 'Опубликованная статья', url: '/publications/transparent-help' }] : [];
    return { ok: true, json: async () => ({ data: { items } }) };
  });
});

describe('Header navigation and search', () => {
  test('opens and closes the main menu without leaving the page locked', () => {
    render(<MemoryRouter><Header /></MemoryRouter>);
    const menuButton = screen.getByRole('button', { name: 'Открыть меню' });

    fireEvent.click(menuButton);
    expect(menuButton).toHaveAccessibleName('Закрыть меню');
    expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('navigation', { name: 'Основная навигация' })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('hidden');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(menuButton).toHaveAccessibleName('Открыть меню');
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    expect(document.body.style.overflow).toBe('');
  });

  test('searches public API content and reports an empty result', async () => {
    render(<MemoryRouter><Header /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Поиск по разделам' }));
    const input = screen.getByRole('searchbox', { name: 'Найти раздел или материал' });

    fireEvent.change(input, { target: { value: 'прозрачной' } });
    expect(await screen.findByRole('link', { name: 'Принципы прозрачной помощи' })).toHaveAttribute('href', '/publications/transparent-help');

    fireEvent.change(input, { target: { value: 'запрос-без-совпадений' } });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Ничего не найдено'));
  });
});

describe('ContentState', () => {
  test('renders loading, error and custom empty states', () => {
    const { rerender } = render(<ContentState loading />);
    expect(screen.getByText('Загружаем материалы…')).toBeInTheDocument();

    rerender(<ContentState error={new Error('failed')} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Не удалось загрузить материалы');

    rerender(<ContentState empty emptyMessage="Пока пусто" />);
    expect(screen.getByText('Пока пусто')).toBeInTheDocument();
  });
});
