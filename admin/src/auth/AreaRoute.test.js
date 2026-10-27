import { render, screen } from '@testing-library/react';
import AreaRoute from './AreaRoute';
import { useAuth } from './AuthContext';

jest.mock('./AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('react-router-dom', () => ({
  Navigate: ({ to }) => <p>Переход: {to}</p>,
  Outlet: () => <p>Разрешённый раздел</p>,
}));

test('EDITOR без доступа к разделу не проходит route guard', () => {
  useAuth.mockReturnValue({ user: { role: 'EDITOR' }, hasArea: () => false });
  render(<AreaRoute area="MEDIA" />);
  expect(screen.getByText('Переход: /')).toBeInTheDocument();
  expect(screen.queryByText('Разрешённый раздел')).not.toBeInTheDocument();
});

test('ADMIN проходит admin-only route guard', () => {
  useAuth.mockReturnValue({ user: { role: 'ADMIN' }, hasArea: () => true });
  render(<AreaRoute adminOnly />);
  expect(screen.getByText('Разрешённый раздел')).toBeInTheDocument();
});
