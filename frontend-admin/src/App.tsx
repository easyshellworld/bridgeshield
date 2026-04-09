import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import AppealPage from './pages/AppealPage';
import WhitelistPage from './pages/WhitelistPage';
import LogsPage from './pages/LogsPage';
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

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-8 py-4">
          <h2 className="text-xl font-semibold text-gray-900">Admin Dashboard</h2>
        </header>
        <main className="flex-1 overflow-y-auto bg-background p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/appeals" element={<AppealPage />} />
          <Route path="/whitelist" element={<WhitelistPage />} />
          <Route path="/logs" element={<LogsPage />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;