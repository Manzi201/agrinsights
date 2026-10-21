import type { ReactNode } from 'react';
import type { Insight } from '../../types/agriculture';
import { AlertTriangle, CheckCircle2, Info, AlertOctagon } from 'lucide-react';

const config: Record<Insight['type'], { icon: ReactNode; bg: string; border: string; text: string }> = {
  positive: { icon: <CheckCircle2 className="w-5 h-5" />, bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700' },
  warning: { icon: <AlertTriangle className="w-5 h-5" />, bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
  critical: { icon: <AlertOctagon className="w-5 h-5" />, bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
  info: { icon: <Info className="w-5 h-5" />, bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
};

interface InsightCardProps {
  insight: Insight;
}

export default function InsightCard({ insight }: InsightCardProps) {
  const c = config[insight.type];

  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} p-4 flex gap-3`}>
      <div className={`flex-shrink-0 ${c.text}`}>{c.icon}</div>
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-sm text-gray-900">{insight.title}</h4>
        <p className="text-sm text-gray-600 mt-1 leading-relaxed">{insight.description}</p>
        {insight.changePercent !== undefined && (
          <span className={`text-xs font-medium mt-2 inline-block ${c.text}`}>
            {insight.changePercent > 0 ? '+' : ''}
            {insight.changePercent}% change
          </span>
        )}
      </div>
    </div>
  );
}
