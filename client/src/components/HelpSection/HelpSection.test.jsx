import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HelpSection from './HelpSection';


vi.mock('../../hooks/useContent', async () => {
  const { helpMethods } = await import('../../data/content');
  return { useCollection: () => ({ data: helpMethods, loading: false, error: null }) };
});

test('shows exactly three non-payment help routes', () => {
  render(<MemoryRouter><HelpSection /></MemoryRouter>);

  const options = screen.getAllByRole('listitem');
  expect(options).toHaveLength(3);
  expect(screen.getByRole('link', { name: 'Помочь детям' })).toHaveAttribute('href', '/children');
  expect(screen.getByRole('link', { name: 'Стать волонтёром' })).toHaveAttribute('href', '/give-help/volunteer');
  expect(screen.getByRole('link', { name: 'Для компаний' })).toHaveAttribute('href', '/give-help/for-companies');
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(screen.queryByText(/₽|пожертв|плат[её]ж/i)).not.toBeInTheDocument();
});
