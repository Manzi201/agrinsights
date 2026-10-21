import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar, { MobileDrawer } from './Sidebar';
import Header from './Header';

function getInitialCollapsed(): boolean {
  try {
    return localStorage.getItem('sidebar-collapsed') === 'true';
  } catch {
    return false;
  }
}

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(getInitialCollapsed);

  const handleToggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem('sidebar-collapsed', String(next)); } catch { /* ignore */ }
      return next;
    });
  };

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Desktop sidebar */}
      <Sidebar collapsed={collapsed} onToggleCollapse={handleToggleCollapse} />

      {/* Mobile drawer */}
      <MobileDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-auto bg-gray-50 dark:bg-gray-950">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
