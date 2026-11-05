import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProjectsSection from './ProjectsSection';
import { useCollection } from '../../hooks/useContent';

vi.mock('react-router-dom', () => ({ Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a> }));
vi.mock('../../hooks/useContent', () => ({ useCollection: vi.fn() }));

test('limits the homepage project list to three entries', () => {
  useCollection.mockReturnValue({
    loading: false,
    error: null,
    data: Array.from({ length: 5 }, (_, index) => ({ id: `project-${index + 1}`, slug: `project-${index + 1}`, title: `Проект ${index + 1}` })),
  });

  render(<ProjectsSection itemLimit={8} />);

  expect(screen.getByRole('link', { name: 'Проект 1' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Проект 3' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Проект 4' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Все проекты' })).toHaveAttribute('href', '/what-we-do');
  expect(useCollection).toHaveBeenCalledWith('projects', { pageSize: 3 });
});
