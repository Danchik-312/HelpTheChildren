import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MediaPage from './MediaPage';
import { mediaApi } from '../api/contentApi';
import MediaPicker from '../components/MediaPicker';

jest.mock('../api/contentApi', () => ({ mediaApi: { list: jest.fn(), upload: jest.fn(), usages: jest.fn(), update: jest.fn(), remove: jest.fn() } }));
jest.mock('../auth/AuthContext', () => ({ useAuth: () => ({ user: { role: 'ADMIN' } }) }));
jest.mock('../components/PrivateMediaPreview', () => () => <span>preview</span>);

beforeEach(() => {
  jest.clearAllMocks();
  mediaApi.list.mockResolvedValue({ items: [], meta: {} });
});

test('загружает выбранное изображение и передаёт права и alt-текст в FormData', async () => {
  mediaApi.upload.mockResolvedValue({ id: 'media-1' });
  const file = new File(['image-bytes'], 'photo.png', { type: 'image/png' });
  render(<MediaPage />);
  await screen.findByText('Файлов пока нет');

  fireEvent.change(screen.getByLabelText('Изображение или видео'), { target: { files: [file] } });
  fireEvent.change(screen.getByLabelText('Альтернативный текст'), { target: { value: 'Дети на прогулке' } });
  fireEvent.click(screen.getByLabelText('Подтверждаю право на использование файла'));
  fireEvent.click(screen.getByRole('button', { name: 'Загрузить' }));

  await waitFor(() => expect(mediaApi.upload).toHaveBeenCalledTimes(1));
  const formData = mediaApi.upload.mock.calls[0][0];
  expect(formData).toBeInstanceOf(FormData);
  expect(formData.get('file')).toBe(file);
  expect(formData.get('defaultAlt')).toBe('Дети на прогулке');
  expect(formData.get('rightsConfirmed')).toBe('true');
});

test('показывает ошибку API загрузки, не имитируя успешное сохранение', async () => {
  mediaApi.upload.mockRejectedValue(new Error('Нет прав на загрузку'));
  render(<MediaPage />);
  await screen.findByText('Файлов пока нет');
  fireEvent.change(screen.getByLabelText('Изображение или видео'), { target: { files: [new File(['x'], 'x.png', { type: 'image/png' })] } });
  fireEvent.click(screen.getByRole('button', { name: 'Загрузить' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Нет прав на загрузку');
});

test('выбор изображения в медиатеке возвращает запись API и закрывает окно', async () => {
  const onChange = jest.fn();
  const onClose = jest.fn();
  const image = { id: 'media-2', kind: 'IMAGE', originalName: 'cover.png' };
  mediaApi.list.mockResolvedValue({ items: [image, { id: 'video-1', kind: 'VIDEO', originalName: 'clip.mp4' }] });
  render(<MediaPicker value={null} onChange={onChange} onClose={onClose} />);
  fireEvent.click(await screen.findByRole('button', { name: /cover\.png/ }));
  expect(onChange).toHaveBeenCalledWith(image);
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('button', { name: /clip\.mp4/ })).not.toBeInTheDocument();
});
