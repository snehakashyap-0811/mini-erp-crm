import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { getToken, getUser } from '../lib/auth';

export function ProtectedRoute({ roles }: { roles?: string[] }) {
  const token = getToken();
  const user = getUser();
  const location = useLocation();

  if (!token || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
