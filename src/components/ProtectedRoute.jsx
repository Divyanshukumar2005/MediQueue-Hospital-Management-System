import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROUTES, roleHome } from '../lib/routes';

export function FullPageSpinner({ text = 'Loading…' }) {
  return (
    <div className="loading-overlay">
      <div className="spinner spinner-blue" style={{ width: 40, height: 40, borderWidth: 4 }} />
      <p>{text}</p>
    </div>
  );
}

/** <ProtectedRoute roles={['patient']}> … </ProtectedRoute>  (replaces requireAuth(['patient'])) */
export default function ProtectedRoute({ roles = [], children }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <FullPageSpinner />;
  if (!user) return <Navigate to={ROUTES.login} replace state={{ from: loc.pathname }} />;
  if (roles.length && !roles.includes(user.role)) return <Navigate to={roleHome(user.role)} replace />;
  return children;
}
