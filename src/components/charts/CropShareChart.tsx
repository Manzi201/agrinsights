import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import type { CategoryShare } from '../../services/nisr';

const categoryColors: Record<string, string> = {
  Cereals: '#f59e0b',
  Legumes: '#8b5cf6',
  'Roots & Tubers': '#14b8a6',
  Other: '#64748b',
};

interface CropShareChartProps {
  data: CategoryShare[];
}

export default function CropShareChart({ data }: CropShareChartProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">
        Production Share by Crop Category
      </h3>
      <div style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="production"
              nameKey="category"
              cx="50%"
              cy="50%"
              outerRadius={90}
              innerRadius={50}
              paddingAngle={2}
            >
              {data.map((entry) => (
                <Cell key={entry.category} fill={categoryColors[entry.category] ?? '#64748b'} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => [Number(value).toLocaleString() + ' t', 'Production']}
              contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
