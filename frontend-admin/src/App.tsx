import { useMemo, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import AppealPage from './pages/AppealPage';
import WhitelistPage from './pages/WhitelistPage';
import LogsPage from './pages/LogsPage';
import LoginPage from './pages/LoginPage';
import { clearAdminSession, getAdminUser, isAdminAuthenticated } from './auth/session';
import './index.css';

const navigation = [
  { name: 'Dashboard', href: '/', icon: '📊' },
  { name: 'Appeals', href: '/appeals', icon: '📋' },
  { name: 'Whitelist', href: '/whitelist', icon: '✅' },
  { name: 'Logs', href: '/logs', icon: '📜' },
];

function Sidebar() {
  const location = useLocation();
  return (
    <div className="w-64 bg-sidebar text-white min-h-screen p-4">
      <div className="flex items-center gap-2 mb-8 px-2">
        <span className="text-2xl">🛡️</span>
        <h1 className="text-xl font-bold">BridgeShield</h1>
      </div>
      <nav className="space-y-1">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.name}
              to={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium ${
                isActive ? 'bg-primary text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}
            >
              <span>{item.icon}</span>
              {item.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function Layout({ onLogout }: { onLogout: () => void }) {
  const adminUser = useMemo(() => getAdminUser(), []);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Admin Dashboard</h2>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">{adminUser?.username || 'admin'}</span>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Logout
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto bg-background p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function ProtectedLayout({
  authenticated,
  onLogout,
}: {
  authenticated: boolean;
  onLogout: () => void;
}) {
  if (!authenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Layout onLogout={onLogout} />;
}

function App() {
  const [authenticated, setAuthenticated] = useState<boolean>(isAdminAuthenticated());

  return (
    <Router>
      <Routes>
        <Route
          path="/login"
          element={
            authenticated ? (
              <Navigate to="/" replace />
            ) : (
              <LoginPage
                onLoginSuccess={() => {
                  setAuthenticated(true);
                }}
              />
            )
          }
        />
        <Route
          element={
            <ProtectedLayout
              authenticated={authenticated}
              onLogout={() => {
                clearAdminSession();
                setAuthenticated(false);
              }}
            />
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/appeals" element={<AppealPage />} />
          <Route path="/whitelist" element={<WhitelistPage />} />
          <Route path="/logs" element={<LogsPage />} />
        </Route>
        <Route path="*" element={<Navigate to={authenticated ? '/' : '/login'} replace />} />
      </Routes>
    </Router>
  );
}

export default App;
