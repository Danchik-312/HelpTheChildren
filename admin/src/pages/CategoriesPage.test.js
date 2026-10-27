import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CategoriesPage from './CategoriesPage';
import { categoriesApi } from '../api/contentApi';

jest.mock('../api/contentApi', () => ({ categoriesApi: { list: jest.fn(), create: jest.fn(), update: jest.fn(), remove: jest.fn() } }));

beforeEach(() => {
  jest.clearAllMocks();
  categoriesApi.list.mockResolvedValue({ items: [{ id: 'cat-1', name: 'Новости', slug: 'news', publicationCount: 2 }] });
  window.confirm = jest.fn(() => true);
});

test('отображает реальные категории и сообщает о конфликте удаления используемой категории', async () => {
  categoriesApi.remove.mockRejectedValue(Object.assign(new Error('Категория используется'), { code: 'CATEGORY_IN_USE' }));
  render(<CategoriesPage />);
  expect(await screen.findByText('Новости')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));
  await waitFor(() => expect(categoriesApi.remove).toHaveBeenCalledWith('cat-1'));
  expect(await screen.findByRole('alert')).toHaveTextContent('Категория используется публикациями и не может быть удалена.');
  expect(screen.getByText('Новости')).toBeInTheDocument();
});

test('создаёт категорию через API и повторно загружает список', async () => {
  categoriesApi.create.mockResolvedValue({ id: 'cat-2', name: 'Статьи', slug: 'articles' });
  render(<CategoriesPage />);
  await screen.findByText('Новости');
  fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Статьи' } });
  fireEvent.change(screen.getAllByRole('textbox')[1], { target: { value: 'articles' } });
  fireEvent.click(screen.getByRole('button', { name: 'Создать' }));
  await waitFor(() => expect(categoriesApi.create).toHaveBeenCalledWith({ name: 'Статьи', slug: 'articles' }));
  await waitFor(() => expect(categoriesApi.list).toHaveBeenCalledTimes(2));
});
