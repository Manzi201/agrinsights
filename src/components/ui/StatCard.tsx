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
  label,
  value,
  unit,
  icon,
  changePercent,
  changeLabel,
  color = 'primary',
}: StatCardProps) {
  const colorClasses: Record<string, string> = {
    primary: 'bg-primary-50 text-primary-700',
    amber: 'bg-amber-50 text-amber-700',
    blue: 'bg-blue-50 text-blue-700',
    purple: 'bg-purple-50 text-purple-700',
    red: 'bg-red-50 text-red-700',
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{label}</p>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-bold text-gray-900">{value}</span>
            {unit && <span className="text-sm text-gray-400">{unit}</span>}
          </div>
        </div>
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colorClasses[color] ?? colorClasses.primary}`}>
          {icon}
        </div>
      </div>
      {(changePercent !== undefined || changeLabel) && (
        <div className="mt-3 flex items-center gap-1.5 text-xs">
          {changePercent !== undefined && (
            <span
              className={`flex items-center gap-1 font-medium ${
                changePercent > 0 ? 'text-green-600' : changePercent < 0 ? 'text-red-600' : 'text-gray-500'
              }`}
            >
              {changePercent > 0 && <TrendingUp className="w-3.5 h-3.5" />}
              {changePercent < 0 && <TrendingDown className="w-3.5 h-3.5" />}
              {changePercent > 0 ? '+' : ''}
              {changePercent}%
            </span>
          )}
          {changeLabel && <span className="text-gray-400">{changeLabel}</span>}
        </div>
      )}
    </div>
  );
}
