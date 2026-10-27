import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HelpSection from './HelpSection';

jest.mock('react-router/dom', () => {
  const { TextDecoder, TextEncoder } = require('util');
  global.TextDecoder = TextDecoder;
  global.TextEncoder = TextEncoder;
  return require('react-router/dist/development/dom-export.js');
}, { virtual: true });

jest.mock('../../hooks/useContent', () => ({
  useCollection: () => ({ data: require('../../data/content').helpMethods, loading: false, error: null }),
}));

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
