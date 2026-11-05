import { vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { siteApi } from '../api/contentApi';
import OrganizationPage from './OrganizationPage';

vi.mock('../api/contentApi', () => ({ siteApi: { get: vi.fn(), updateOrganization: vi.fn() } }));
const auth = vi.hoisted(() => ({ role: 'ADMIN' }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ user: { role: auth.role } }) }));

beforeEach(() => { auth.role = 'ADMIN'; vi.clearAllMocks(); });

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
  auth.role = 'EDITOR';
  siteApi.get.mockResolvedValue({ organization: { displayName: 'Фонд' } });
  render(<OrganizationPage />);
  expect(await screen.findByText(/Доступ только для чтения/)).toBeInTheDocument();
  expect(screen.getByLabelText('Название организации')).toBeDisabled();
  expect(screen.queryByRole('button', { name: 'Сохранить' })).not.toBeInTheDocument();
});
