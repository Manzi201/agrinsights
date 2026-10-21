import type { ReactNode } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string;
  unit?: string;
  icon: ReactNode;
  changePercent?: number;
  changeLabel?: string;
  color?: string;
}

export default function StatCard({
  label, value, unit, icon, changePercent, changeLabel, color = 'primary',
}: StatCardProps) {
  const colorClasses: Record<string, string> = {
    primary: 'bg-primary-50 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300',
    amber:   'bg-amber-50  dark:bg-amber-900/40  text-amber-700  dark:text-amber-300',
    blue:    'bg-blue-50   dark:bg-blue-900/40   text-blue-700   dark:text-blue-300',
    purple:  'bg-purple-50 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',
    red:     'bg-red-50    dark:bg-red-900/40    text-red-700    dark:text-red-300',
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium truncate">{label}</p>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{value}</span>
            {unit && <span className="text-xs sm:text-sm text-gray-400 dark:text-gray-500">{unit}</span>}
          </div>
        </div>
        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center flex-shrink-0 ml-2 ${colorClasses[color] ?? colorClasses.primary}`}>
          {icon}
        </div>
      </div>
      {(changePercent !== undefined || changeLabel) && (
        <div className="mt-2 flex items-center gap-1.5 text-xs">
          {changePercent !== undefined && (
            <span className={`flex items-center gap-1 font-medium ${
              changePercent > 0 ? 'text-green-600 dark:text-green-400'
              : changePercent < 0 ? 'text-red-600 dark:text-red-400'
              : 'text-gray-500 dark:text-gray-400'
            }`}>
              {changePercent > 0 && <TrendingUp className="w-3.5 h-3.5" />}
              {changePercent < 0 && <TrendingDown className="w-3.5 h-3.5" />}
              {changePercent > 0 ? '+' : ''}{changePercent}%
            </span>
          )}
          {changeLabel && <span className="text-gray-400 dark:text-gray-500">{changeLabel}</span>}
        </div>
      )}
    </div>
  );
}
