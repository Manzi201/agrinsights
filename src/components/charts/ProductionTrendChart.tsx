import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import type { TrendPoint } from '../../services/nisr';

interface ProductionTrendChartProps {
  data: TrendPoint[];
  cropName: string;
  cropColor: string;
}

export default function ProductionTrendChart({ data, cropName, cropColor }: ProductionTrendChartProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">
        {cropName} Production Trend (2018–2024)
      </h3>
      <div style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="year" tick={{ fontSize: 12 }} stroke="#9ca3af" />
            <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
            <Tooltip
              formatter={(value) => [Number(value).toLocaleString() + ' t', 'Production']}
              contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              type="monotone"
              dataKey="production"
              name="Production (tons)"
              stroke={cropColor}
              strokeWidth={2}
              dot={{ r: 4, fill: cropColor }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="area"
              name="Area (hectares)"
              stroke="#94a3b8"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ r: 4, fill: '#94a3b8' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
