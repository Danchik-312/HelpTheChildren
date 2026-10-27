import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { siteApi } from '../api/contentApi';
import OrganizationPage from './OrganizationPage';

jest.mock('../api/contentApi', () => ({ siteApi: { get: jest.fn(), updateOrganization: jest.fn() } }));
let mockRole = 'ADMIN';
jest.mock('../auth/AuthContext', () => ({ useAuth: () => ({ user: { role: mockRole } }) }));

beforeEach(() => { mockRole = 'ADMIN'; jest.clearAllMocks(); });

test('загружает агрегат сайта и сохраняет описание структурированным JSON', async () => {
  siteApi.get.mockResolvedValue({ organization: { displayName: 'Фонд', shortDescription: 'Кратко', description: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'О фонде' }] }] } } });
  siteApi.updateOrganization.mockResolvedValue({});
  render(<OrganizationPage />);
  const name = await screen.findByLabelText('Название организации');
  fireEvent.change(name, { target: { value: 'Новый фонд' } });
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
  await waitFor(() => expect(siteApi.updateOrganization).toHaveBeenCalledWith(expect.objectContaining({ displayName: 'Новый фонд', description: expect.objectContaining({ type: 'doc' }) })));
});

test('для редактора форма доступна только для чтения', async () => {
  mockRole = 'EDITOR';
  siteApi.get.mockResolvedValue({ organization: { displayName: 'Фонд' } });
  render(<OrganizationPage />);
  expect(await screen.findByText(/Доступ только для чтения/)).toBeInTheDocument();
  expect(screen.getByLabelText('Название организации')).toBeDisabled();
  expect(screen.queryByRole('button', { name: 'Сохранить' })).not.toBeInTheDocument();
});
