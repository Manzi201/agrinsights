import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useTheme } from '../../context/ThemeContext';
import { crops } from '../../services/agricultureData';

export interface ComparisonDataItem { label: string; [cropId: string]: string | number; }
interface Props { data: ComparisonDataItem[]; selectedCropIds: string[]; }

export default function ComparisonChart({ data, selectedCropIds }: Props) {
  const { isDark } = useTheme();
  const grid = isDark ? '#374151' : '#e5e7eb';
  const axis = isDark ? '#6b7280' : '#9ca3af';
  const tt = { borderRadius: '8px', border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`, fontSize: '12px', backgroundColor: isDark ? '#1f2937' : '#fff', color: isDark ? '#f3f4f6' : '#111827' };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">Crop Comparison by District</h3>
      <div style={{ height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: axis }} stroke={axis} />
            <YAxis tick={{ fontSize: 11, fill: axis }} stroke={axis} />
            <Tooltip formatter={(v) => [Number(v).toLocaleString() + ' t', '']} contentStyle={tt} />
            <Legend wrapperStyle={{ fontSize: 12, color: isDark ? '#9ca3af' : undefined }} />
            {selectedCropIds.map((cropId) => {
              const crop = crops.find((c) => c.id === cropId);
              return <Bar key={cropId} dataKey={cropId} name={crop?.name ?? cropId} fill={crop?.color ?? '#16a34a'} radius={[4, 4, 0, 0]} />;
            })}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
