import { lazy, Suspense } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './api/auth';
import { AppShell } from './components/AppShell';
import { AuthPage } from './pages/AuthPage';
import { BoardPage } from './pages/BoardPage';

// The list view is the less-used screen, so it is split out of the first download.
const ListPage = lazy(() => import('./pages/ListPage').then((m) => ({ default: m.ListPage })));

function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="splash" role="status" aria-label="Loading" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route path="/board" element={<BoardPage />} />
          <Route
            path="/list"
            element={
              <Suspense fallback={<div className="splash-inline" role="status" aria-label="Loading" />}>
                <ListPage />
              </Suspense>
            }
          />
          <Route path="/" element={<Navigate to="/board" replace />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/board" replace />} />
    </Routes>
  );
}
