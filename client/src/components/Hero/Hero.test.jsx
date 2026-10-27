import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import Hero from './Hero';

jest.mock('react-router-dom', () => ({ Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a> }));
jest.mock('../../assets/icons/next.svg', () => ({ ReactComponent: () => <span aria-hidden="true" /> }));
jest.mock('../../hooks/useInView', () => () => ({ ref: { current: null }, isInView: true }));
jest.mock('../../hooks/useReducedMotion', () => () => true);
jest.mock('../../hooks/useContent', () => ({ useCollection: () => ({
  data: [{ id: 'hero', title: 'Проект', description: 'Описание', altText: 'Видео о проекте', isDecorative: false, media: { kind: 'VIDEO', url: 'http://localhost/video' }, poster: { url: 'http://localhost/poster' } }],
  loading: false,
  error: null,
}) }));

test('renders CMS video with poster and accessible fallback after load error', () => {
  render(<Hero />);
  const video = screen.getByLabelText('Видео о проекте');
  expect(video.tagName).toBe('VIDEO');
  expect(video).toHaveAttribute('poster', 'http://localhost/poster');
  fireEvent.error(video);
  expect(screen.getByRole('img', { name: 'Видео о проекте' })).toBeInTheDocument();
});
