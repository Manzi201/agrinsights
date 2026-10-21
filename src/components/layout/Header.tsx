import { useLocation } from 'react-router-dom';
import { Wifi, WifiOff } from 'lucide-react';
import { isUsingMockData } from '../../services/nisr';
import { useDataVersion } from '../../hooks/useAgricultureData';
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
  const pageInfo = pageTitles[location.pathname] ?? { title: 'Agrinsights', subtitle: '' };
  const mock = isUsingMockData();

  return (
    <header className="bg-white border-b border-gray-200 px-3 sm:px-5 py-3 sticky top-0 z-30">
      <div className="flex items-center justify-between gap-3">
        {/* Left: hamburger + title */}
        <div className="flex items-center gap-3 min-w-0">
          <MobileMenuButton onClick={onMenuClick} />
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-gray-900 truncate">{pageInfo.title}</h2>
            <p className="text-xs text-gray-500 hidden sm:block truncate">{pageInfo.subtitle}</p>
          </div>
        </div>

        {/* Right: data source indicator */}
        <div className={`flex items-center gap-1.5 text-xs flex-shrink-0 ${mock ? 'text-amber-600' : 'text-green-600'}`}>
          {mock ? <WifiOff className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">NISR {mock ? '(mock)' : '(live)'}</span>
          <span className="sm:hidden">{mock ? 'Mock' : 'Live'}</span>
        </div>
      </div>
    </header>
  );
}
