import type { ReactNode } from 'react';
import type { Insight } from '../../types/agriculture';
import { AlertTriangle, CheckCircle2, Info, AlertOctagon } from 'lucide-react';

const config: Record<Insight['type'], { icon: ReactNode; base: string }> = {
  positive: {
    icon: <CheckCircle2 className="w-5 h-5" />,
    base: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400',
  },
  warning: {
    icon: <AlertTriangle className="w-5 h-5" />,
    base: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400',
  },
  critical: {
    icon: <AlertOctagon className="w-5 h-5" />,
    base: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400',
  },
  info: {
    icon: <Info className="w-5 h-5" />,
    base: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400',
  },
};

export default function InsightCard({ insight }: { insight: Insight }) {
  const c = config[insight.type];
  return (
    <div className={`rounded-xl border p-4 flex gap-3 ${c.base}`}>
      <div className="flex-shrink-0 mt-0.5">{c.icon}</div>
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100">{insight.title}</h4>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">{insight.description}</p>
        {insight.changePercent !== undefined && (
          <span className="text-xs font-medium mt-2 inline-block">
            {insight.changePercent > 0 ? '+' : ''}{insight.changePercent}% change
          </span>
        )}
      </div>
    </div>
  );
}
