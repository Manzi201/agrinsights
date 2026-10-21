import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useTheme } from '../../context/ThemeContext';
import type { TrendPoint } from '../../services/nisr';

interface Props { data: TrendPoint[]; cropName: string; cropColor: string; }

export default function ProductionTrendChart({ data, cropName, cropColor }: Props) {
  const { isDark } = useTheme();
  const grid = isDark ? '#374151' : '#e5e7eb';
  const axis = isDark ? '#6b7280' : '#9ca3af';
  const tt = { borderRadius: '8px', border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`, fontSize: '12px', backgroundColor: isDark ? '#1f2937' : '#fff', color: isDark ? '#f3f4f6' : '#111827' };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">
        {cropName} Production Trend (2018–2024)
      </h3>
      <div style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} />
            <XAxis dataKey="year" tick={{ fontSize: 12, fill: axis }} stroke={axis} />
            <YAxis tick={{ fontSize: 12, fill: axis }} stroke={axis} />
            <Tooltip formatter={(v) => [Number(v).toLocaleString() + ' t', 'Production']} contentStyle={tt} />
            <Legend wrapperStyle={{ fontSize: 12, color: axis }} />
            <Line type="monotone" dataKey="production" name="Production (tons)" stroke={cropColor} strokeWidth={2} dot={{ r: 4, fill: cropColor }} activeDot={{ r: 6 }} />
            <Line type="monotone" dataKey="area" name="Area (hectares)" stroke={isDark ? '#6b7280' : '#94a3b8'} strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
