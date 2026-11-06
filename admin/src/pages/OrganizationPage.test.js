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

test('показывает текущие цвета до обновления API без возможности отправить их на сохранение', async () => {
  siteApi.get.mockResolvedValue({ organization: { displayName: 'Фонд' } });
  siteApi.updateOrganization.mockResolvedValue({});
  render(<OrganizationPage />);
  expect(await screen.findByLabelText('Шапка и подвал')).toHaveValue('#DC6601');
  expect(screen.getByLabelText('Hero и акценты')).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
  expect(siteApi.updateOrganization.mock.calls[0][0]).not.toHaveProperty('brandColor');
});

test('загружает и сохраняет цвета в HEX, когда API поддерживает настройки', async () => {
  siteApi.get.mockResolvedValue({ organization: { displayName: 'Фонд', brandColor: '#dc6601', accentColor: '#bfff00' } });
  siteApi.updateOrganization.mockResolvedValue({ brandColor: '#162030', accentColor: '#ab12cd' });
  render(<OrganizationPage />);
  const brand = await screen.findByLabelText('Шапка и подвал');
  fireEvent.change(brand, { target: { value: '#162030' } });
  const accent = screen.getByLabelText('Hero и акценты');
  fireEvent.change(accent, { target: { value: 'invalid' } });
  expect(accent).toBeInvalid();
  fireEvent.change(accent, { target: { value: '#ab12cd' } });
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
  await waitFor(() => expect(siteApi.updateOrganization).toHaveBeenCalledWith(expect.objectContaining({ brandColor: '#162030', accentColor: '#AB12CD' })));
  expect(await screen.findByRole('status')).toBeInTheDocument();
  expect(accent).toHaveValue('#AB12CD');
});
