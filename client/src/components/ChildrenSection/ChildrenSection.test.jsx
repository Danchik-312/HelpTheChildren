import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import ChildrenSection from './ChildrenSection';
import { useCollection } from '../../hooks/useContent';

jest.mock('react-router-dom', () => ({ Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a> }));
jest.mock('../../assets/icons/next.svg', () => ({ ReactComponent: () => <span aria-hidden="true" /> }));
jest.mock('../../hooks/useContent', () => ({ useCollection: jest.fn() }));
jest.mock('../../hooks/useInView', () => () => ({ ref: { current: null }, isInView: true }));
jest.mock('../../hooks/useReducedMotion', () => () => true);

const children = Array.from({ length: 6 }, (_, index) => ({
  id: `child-${index + 1}`,
  slug: `child-${index + 1}`,
  name: `Ребёнок ${index + 1}`,
  disease: `Описание ${index + 1}`,
  image: `/child-${index + 1}.jpg`,
}));

test('renders child cards, carousel controls and the all-cards link', () => {
  useCollection.mockReturnValue({ data: children, loading: false, error: null });
  render(<ChildrenSection />);

  expect(screen.getAllByRole('article')).toHaveLength(6);
  expect(screen.getByRole('link', { name: 'Все карточки' })).toHaveAttribute('href', '/children');

  const viewport = screen.getByRole('region', { name: 'Карточки детей' });
  Object.defineProperties(viewport, {
    clientWidth: { configurable: true, value: 900 },
    scrollWidth: { configurable: true, value: 1800 },
    scrollLeft: { configurable: true, writable: true, value: 0 },
  });
  viewport.scrollBy = jest.fn();
  fireEvent.scroll(viewport);

  const next = screen.getByRole('button', { name: 'Следующие карточки детей' });
  expect(next).toBeEnabled();
  fireEvent.click(next);
  expect(viewport.scrollBy).toHaveBeenCalledWith({ left: 900, behavior: 'auto' });
});
