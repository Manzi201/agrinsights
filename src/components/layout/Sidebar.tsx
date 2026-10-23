import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Map, BarChart3, Lightbulb,
  FileText, Sprout, X, Menu, ChevronLeft, ChevronRight, Rocket, Coffee,
} from 'lucide-react';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/map', label: 'Agricultural Map', icon: Map },
  { to: '/comparison', label: 'Crop Comparison', icon: BarChart3 },
  { to: '/insights', label: 'Insights', icon: Lightbulb },
  { to: '/solutions', label: 'Solutions', icon: Rocket },
  { to: '/cash-crops', label: 'Cash Crops', icon: Coffee },
  { to: '/reports', label: 'Reports', icon: FileText },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

// ── Shared nav content ───────────────────────────────────────────────────────
function SidebarContent({
  collapsed,
  onClose,
  onToggleCollapse,
  isMobile = false,
}: {
  collapsed: boolean;
  onClose: () => void;
  onToggleCollapse?: () => void;
  isMobile?: boolean;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Logo row */}
      <div className="px-3 py-4 border-b border-primary-800 flex items-center justify-between min-h-[64px]">
        {/* Logo icon always visible */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 bg-primary-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Sprout className="w-5 h-5 text-white" />
          </div>
          {/* Text hidden when collapsed (desktop) */}
          {(!collapsed || isMobile) && (
            <div className="min-w-0">
              <h1 className="text-base font-bold leading-tight text-white truncate">Agrinsights</h1>
              <p className="text-xs text-primary-300 truncate">Smart Agriculture Rwanda</p>
            </div>
          )}
        </div>

        {/* Desktop collapse toggle */}
        {!isMobile && onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-lg text-primary-300 hover:text-white hover:bg-primary-700 transition-colors flex-shrink-0"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        )}

        {/* Mobile close button */}
        {isMobile && (
          <button
            onClick={onClose}
            className="p-1.5 text-primary-300 hover:text-white transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
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
              title={collapsed && !isMobile ? item.label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg mb-0.5 transition-colors group
                ${collapsed && !isMobile ? 'px-2 py-3 justify-center' : 'px-3 py-2.5'}
                ${isActive
                  ? 'bg-primary-600 text-white'
                  : 'text-primary-200 hover:bg-primary-800 hover:text-white'
                }`
              }
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {(!collapsed || isMobile) && (
                <span className="text-sm font-medium truncate">{item.label}</span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      {(!collapsed || isMobile) && (
        <div className="px-4 py-3 border-t border-primary-800 text-xs text-primary-400">
          <p>Data source: NISR Rwanda</p>
          <p className="mt-0.5">© 2024 Agrinsights</p>
        </div>
      )}

      {/* Collapsed footer — just a small divider spacer */}
      {collapsed && !isMobile && (
        <div className="h-4 border-t border-primary-800" />
      )}
    </div>
  );
}

// ── Desktop sidebar ───────────────────────────────────────────────────────────
interface DesktopSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export default function Sidebar({ collapsed, onToggleCollapse }: DesktopSidebarProps) {
  return (
    <aside
      className={`
        hidden lg:flex flex-col h-screen sticky top-0 flex-shrink-0
        bg-primary-900 text-white overflow-hidden
        transition-all duration-300 ease-in-out
        ${collapsed ? 'w-16' : 'w-60 xl:w-64'}
      `}
    >
      <SidebarContent
        collapsed={collapsed}
        onClose={() => {}}
        onToggleCollapse={onToggleCollapse}
      />
    </aside>
  );
}

// ── Mobile hamburger button ──────────────────────────────────────────────────
export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="lg:hidden p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      aria-label="Open navigation menu"
    >
      <Menu className="w-5 h-5" />
    </button>
  );
}

// ── Mobile drawer ─────────────────────────────────────────────────────────────
export function MobileDrawer({ open, onClose }: SidebarProps) {
  if (!open) return null;
  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40 lg:hidden"
        onClick={onClose}
        aria-hidden
      />
      <aside className="fixed inset-y-0 left-0 w-64 bg-primary-900 text-white z-50 flex flex-col lg:hidden">
        <SidebarContent
          collapsed={false}
          onClose={onClose}
          isMobile
        />
      </aside>
    </>
  );
}
