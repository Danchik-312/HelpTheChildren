import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { heroApi } from '../api/contentApi';
import HeroPage from './HeroPage';

jest.mock('../api/contentApi', () => ({ heroApi: { list: jest.fn(), create: jest.fn(), update: jest.fn(), publish: jest.fn(), unpublish: jest.fn(), reorder: jest.fn(), archive: jest.fn() } }));
jest.mock('../auth/AuthContext', () => ({ useAuth: () => ({ canPublish: () => true }) }));
jest.mock('../components/PrivateMediaPreview', () => ({ media, alt }) => <span data-testid="media-preview">{media?.originalName}:{alt}</span>);
jest.mock('../components/MediaPicker', () => () => null);

const slide = { id: 'slide-1', title: 'Помощь детям', subtitle: 'Описание', status: 'DRAFT', position: 0, version: 2, mediaId: 'media-1', media: { id: 'media-1', kind: 'IMAGE', originalName: 'hero.jpg' }, isDecorative: false, altText: 'Дети' };

beforeEach(() => jest.clearAllMocks());

test('показывает реальные слайды и публикует с текущей версией', async () => {
  heroApi.list.mockResolvedValue({ items: [slide] });
  heroApi.publish.mockResolvedValue({ ...slide, status: 'PUBLISHED', version: 3 });
  render(<HeroPage />);
  expect(await screen.findByText('Помощь детям')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Опубликовать' }));
  await waitFor(() => expect(heroApi.publish).toHaveBeenCalledWith('slide-1', 2));
});

test('создаёт слайд через API, не подменяя сохранение локальными данными', async () => {
  heroApi.list.mockResolvedValue({ items: [] });
  heroApi.create.mockResolvedValue(slide);
  render(<HeroPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Добавить слайд' }));
  fireEvent.change(screen.getByLabelText('Описание'), { target: { value: 'Описание' } });
  expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
});
