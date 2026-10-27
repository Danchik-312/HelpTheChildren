import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function AreaRoute({ area, adminOnly = false }) {
  const { user, hasArea } = useAuth();
  const allowed = adminOnly ? user?.role === 'ADMIN' : hasArea(area);
  return allowed ? <Outlet /> : <Navigate to="/" replace />;
}
