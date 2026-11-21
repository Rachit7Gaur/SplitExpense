
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';

function ProtectedRoute() {
  const { user, authLoading } = useAuth();
  const location = useLocation();

  if (authLoading) {
    return <p className="auth-loading">Checking your session...</p>;
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        state={{ from: location }}
        replace
      />
    );
  }

  return <Outlet />;
}

export default ProtectedRoute;
