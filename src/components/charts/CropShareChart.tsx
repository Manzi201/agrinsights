import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useTheme } from '../../context/ThemeContext';
import type { CategoryShare } from '../../services/nisr';

const categoryColors: Record<string, string> = {
  Cereals: '#f59e0b', Legumes: '#8b5cf6', 'Roots & Tubers': '#14b8a6', Other: '#64748b',
};

export default function CropShareChart({ data }: { data: CategoryShare[] }) {
  const { isDark } = useTheme();
  const tt = { borderRadius: '8px', border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`, fontSize: '12px', backgroundColor: isDark ? '#1f2937' : '#fff', color: isDark ? '#f3f4f6' : '#111827' };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">
        Production Share by Crop Category
      </h3>
      <div style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="production" nameKey="category" cx="50%" cy="50%" outerRadius={90} innerRadius={50} paddingAngle={2}>
              {data.map((entry) => <Cell key={entry.category} fill={categoryColors[entry.category] ?? '#64748b'} />)}
            </Pie>
            <Tooltip formatter={(v) => [Number(v).toLocaleString() + ' t', 'Production']} contentStyle={tt} />
            <Legend wrapperStyle={{ fontSize: 12, color: isDark ? '#9ca3af' : undefined }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
