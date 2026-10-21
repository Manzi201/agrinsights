import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTheme } from '../../context/ThemeContext';
import type { DistrictProduction } from '../../services/nisr';

interface Props { data: DistrictProduction[]; cropName: string; }

export default function DistrictBarChart({ data, cropName }: Props) {
  const { isDark } = useTheme();
  const grid = isDark ? '#374151' : '#e5e7eb';
  const axis = isDark ? '#6b7280' : '#9ca3af';
  const tt = { borderRadius: '8px', border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`, fontSize: '12px', backgroundColor: isDark ? '#1f2937' : '#fff', color: isDark ? '#f3f4f6' : '#111827' };
  const chartData = data.map((d) => ({ name: d.districtName, production: d.production }));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">
        Top 10 Districts — {cropName} Production
      </h3>
      <div style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: axis }} stroke={axis} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: axis }} stroke={axis} width={70} />
            <Tooltip formatter={(v) => [Number(v).toLocaleString() + ' t', 'Production']} contentStyle={tt} />
            <Bar dataKey="production" fill="#16a34a" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
