import { useLocation } from 'react-router-dom';
import { Wifi, WifiOff, Sun, Moon } from 'lucide-react';
import { isUsingMockData } from '../../services/nisr';
import { useDataVersion } from '../../hooks/useAgricultureData';
import { useTheme } from '../../context/ThemeContext';
import { MobileMenuButton } from './Sidebar';

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Dashboard', subtitle: 'Overview of Rwanda agricultural production' },
  '/map': { title: 'Agricultural Map', subtitle: 'Explore production by district' },
  '/comparison': { title: 'Crop Comparison', subtitle: 'Compare crops and districts' },
  '/insights': { title: 'Insights', subtitle: 'Data-driven analysis' },
  '/reports': { title: 'Reports', subtitle: 'Generate and export reports' },
};

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const location = useLocation();
  useDataVersion();
  const { toggle, isDark } = useTheme();
  const pageInfo = pageTitles[location.pathname] ?? { title: 'Agrinsights', subtitle: '' };
  const mock = isUsingMockData();

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-3 sm:px-5 py-3 sticky top-0 z-30">
      <div className="flex items-center justify-between gap-3">
        {/* Left: hamburger + title */}
        <div className="flex items-center gap-3 min-w-0">
          <MobileMenuButton onClick={onMenuClick} />
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white truncate">
              {pageInfo.title}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block truncate">
              {pageInfo.subtitle}
            </p>
          </div>
        </div>

        {/* Right: data source + dark toggle */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className={`flex items-center gap-1.5 text-xs ${mock ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
            {mock ? <WifiOff className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">NISR {mock ? '(mock)' : '(live)'}</span>
          </div>

          {/* Dark mode toggle */}
          <button
            onClick={toggle}
            aria-label="Toggle dark mode"
            className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  );
}
