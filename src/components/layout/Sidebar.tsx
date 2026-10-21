import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Map, BarChart3, Lightbulb, FileText, Sprout, X, Menu } from 'lucide-react';

const navItems = [
  { to: '/', label: 'Dashboard', labelKinyarwanda: 'Ikibangirira', icon: LayoutDashboard },
  { to: '/map', label: 'Agricultural Map', labelKinyarwanda: 'Ikarita', icon: Map },
  { to: '/comparison', label: 'Crop Comparison', labelKinyarwanda: 'Igereranya', icon: BarChart3 },
  { to: '/insights', label: 'Insights', labelKinyarwanda: 'Ibisobanuro', icon: Lightbulb },
  { to: '/reports', label: 'Reports', labelKinyarwanda: 'Raporo', icon: FileText },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

function SidebarContent({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col h-full">
      {/* Logo / Brand */}
      <div className="px-5 py-4 border-b border-primary-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Sprout className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight">Agrinsights</h1>
            <p className="text-xs text-primary-300">Smart Agriculture Rwanda</p>
          </div>
        </div>
        {/* Close button — mobile only */}
        <button
          onClick={onClose}
          className="lg:hidden p-1 text-primary-300 hover:text-white transition-colors"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 transition-colors ${
                  isActive
                    ? 'bg-primary-600 text-white'
                    : 'text-primary-200 hover:bg-primary-800 hover:text-white'
                }`
              }
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium truncate">{item.label}</span>
                <span className="text-xs text-primary-400 truncate">{item.labelKinyarwanda}</span>
              </div>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-primary-800 text-xs text-primary-400">
        <p>Data: NISR Rwanda</p>
        <p className="mt-0.5">© 2024 Agrinsights</p>
      </div>
    </div>
  );
}

export default function Sidebar() {
  return (
    <>
      {/* Desktop sidebar — always visible on lg+ */}
      <aside className="hidden lg:flex w-60 xl:w-64 bg-primary-900 text-white flex-col h-screen sticky top-0 flex-shrink-0">
        <SidebarContent onClose={() => {}} />
      </aside>
    </>
  );
}

/** Mobile-only hamburger button — rendered by Layout */
export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="lg:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
      aria-label="Open menu"
    >
      <Menu className="w-5 h-5" />
    </button>
  );
}

/** Mobile drawer — rendered by Layout */
export function MobileDrawer({ open, onClose }: SidebarProps) {
  if (!open) return null;
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 lg:hidden"
        onClick={onClose}
        aria-hidden
      />
      {/* Drawer */}
      <aside className="fixed inset-y-0 left-0 w-64 bg-primary-900 text-white z-50 flex flex-col lg:hidden">
        <SidebarContent onClose={onClose} />
      </aside>
    </>
  );
}
