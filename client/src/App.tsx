import { lazy, Suspense } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { WorkspaceProvider } from './api/workspace';
import { useAuth } from './api/auth';
import { AppShell } from './components/AppShell';
import { AuthPage } from './pages/AuthPage';
import { BoardPage } from './pages/BoardPage';
import { JoinPage } from './pages/JoinPage';
import { loadListPage } from './pages/lazy';

// The list view is the less-used screen, so it is split out of the first download.
const ListPage = lazy(loadListPage);

function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="splash" role="status" aria-label="Loading" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  // Everything behind sign-in works on one board at a time, so it all sits inside the provider that knows which.
  return (
    <WorkspaceProvider>
      <Outlet />
    </WorkspaceProvider>
  );
}

/** "/" sends people to the board. A link from an assignment email (/?board=..&task=..) also opens that task. */
function Home() {
  const { search } = useLocation();
  const task = new URLSearchParams(search).get('task');
  return <Navigate to={task ? `/board?selected=${encodeURIComponent(task)}` : '/board'} replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route path="/join/:token" element={<JoinPage />} />
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
          <Route path="/" element={<Home />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/board" replace />} />
    </Routes>
  );
}
