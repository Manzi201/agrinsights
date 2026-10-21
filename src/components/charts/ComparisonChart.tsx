import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { crops } from '../../services/agricultureData';

export interface ComparisonDataItem {
  label: string;
  [cropId: string]: string | number;
}

interface ComparisonChartProps {
  data: ComparisonDataItem[];
  selectedCropIds: string[];
}

export default function ComparisonChart({ data, selectedCropIds }: ComparisonChartProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">
        Crop Comparison by District
      </h3>
      <div style={{ height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#9ca3af" />
            <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
            <Tooltip
              formatter={(value) => [Number(value).toLocaleString() + ' t', '']}
              contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {selectedCropIds.map((cropId) => {
              const crop = crops.find((c) => c.id === cropId);
              return (
                <Bar
                  key={cropId}
                  dataKey={cropId}
                  name={crop?.name ?? cropId}
                  fill={crop?.color ?? '#16a34a'}
                  radius={[4, 4, 0, 0]}
                />
              );
            })}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
