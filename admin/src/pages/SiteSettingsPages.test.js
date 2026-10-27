import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { siteApi } from '../api/contentApi';
import ContactsPage from './ContactsPage';
import HomepageBlocksPage from './HomepageBlocksPage';

jest.mock('../api/contentApi', () => ({ siteApi: { get: jest.fn(), createContact: jest.fn(), updateContact: jest.fn(), deleteContact: jest.fn(), updateBlock: jest.fn() } }));
jest.mock('../auth/AuthContext', () => ({ useAuth: () => ({ user: { role: 'ADMIN' } }) }));

beforeEach(() => jest.clearAllMocks());

test('создаёт контакт через site API', async () => {
  siteApi.get.mockResolvedValue({ contacts: [] });
  siteApi.createContact.mockResolvedValue({ id: 'contact-1' });
  render(<ContactsPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Добавить контакт' }));
  fireEvent.change(screen.getByLabelText('Подпись'), { target: { value: 'Горячая линия' } });
  fireEvent.change(screen.getByLabelText('Значение'), { target: { value: '+996 000 000 000' } });
  fireEvent.change(screen.getByLabelText('Ссылка'), { target: { value: 'tel:+996000000000' } });
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
  await waitFor(() => expect(siteApi.createContact).toHaveBeenCalledWith(expect.objectContaining({ label: 'Горячая линия', href: 'tel:+996000000000', isPublic: true })));
});

test('сохраняет настройки блока через endpoint с ключом', async () => {
  siteApi.get.mockResolvedValue({ blocks: [{ id: 'block-1', key: 'children', enabled: true, position: 1, itemLimit: 6, heading: 'Наши дети', description: null, config: null }] });
  siteApi.updateBlock.mockResolvedValue({});
  render(<HomepageBlocksPage />);
  const buttons = await screen.findAllByRole('button', { name: 'Настроить' });
  fireEvent.click(buttons[0]);
  fireEvent.change(screen.getByLabelText('Заголовок'), { target: { value: 'Дети фонда' } });
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
  await waitFor(() => expect(siteApi.updateBlock).toHaveBeenCalledWith('children', expect.objectContaining({ heading: 'Дети фонда', enabled: true, position: 1, itemLimit: 6 })));
});
