import { vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ChildrenSection from './ChildrenSection';
import { useCollection } from '../../hooks/useContent';

vi.mock('react-router-dom', () => ({ Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a> }));
vi.mock('../../assets/icons/next.svg', () => ({ ReactComponent: () => <span aria-hidden="true" /> }));
vi.mock('../../hooks/useContent', () => ({ useCollection: vi.fn() }));
vi.mock('../../hooks/useInView', () => ({ default: () => ({ ref: { current: null }, isInView: true }) }));
vi.mock('../../hooks/useReducedMotion', () => ({ default: () => true }));

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
  viewport.scrollBy = vi.fn();
  fireEvent.scroll(viewport);

  const next = screen.getByRole('button', { name: 'Следующие карточки детей' });
  expect(next).toBeEnabled();
  fireEvent.click(next);
  expect(viewport.scrollBy).toHaveBeenCalledWith({ left: 900, behavior: 'auto' });
});

test('requests at least four published cards when the CMS limit is three', () => {
  useCollection.mockReturnValue({ data: children, loading: false, error: null });
  render(<ChildrenSection itemLimit={3} />);
  expect(useCollection).toHaveBeenCalledWith('children', { pageSize: 4 });
  expect(screen.getAllByRole('article')).toHaveLength(4);
});

test('does not duplicate children when fewer than four are published', () => {
  useCollection.mockReturnValue({ data: children.slice(0, 2), loading: false, error: null });
  render(<ChildrenSection itemLimit={3} />);
  expect(screen.getAllByRole('article')).toHaveLength(2);
  expect(screen.getAllByRole('link', { name: /Ребёнок 1/ })).toHaveLength(1);
  expect(screen.getAllByRole('link', { name: /Ребёнок 2/ })).toHaveLength(1);
});
