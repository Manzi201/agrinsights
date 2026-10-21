import { useState, useMemo } from 'react';
import type { Season } from '../types/agriculture';
import { crops, districts, years } from '../services/agricultureData';
import { compareCrops, formatNumber } from '../utils/calculations';
import ComparisonChart from '../components/charts/ComparisonChart';
import type { ComparisonDataItem } from '../components/charts/ComparisonChart';
import { useDataVersion } from '../hooks/useAgricultureData';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Check } from 'lucide-react';

export default function CropComparison() {
  const [selectedCrops, setSelectedCrops] = useState<string[]>(['maize', 'beans']);
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>(['musanze', 'nyagatare']);
  const [season, setSeason] = useState<Season>('A');
  const [year, setYear] = useState(2024);
  const dataVersion = useDataVersion();

  const toggleCrop = (id: string) => {
    setSelectedCrops((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : prev.length < 4 ? [...prev, id] : prev,
    );
  };

  const toggleDistrict = (id: string) => {
    setSelectedDistricts((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : prev.length < 4 ? [...prev, id] : prev,
    );
  };

  // Comparison data for chart
  const chartData = useMemo<ComparisonDataItem[]>(() => {
    if (selectedCrops.length === 0 || selectedDistricts.length === 0) return [];
    const results = compareCrops(selectedCrops, selectedDistricts, season, year);
    const byDistrict = new Map<string, ComparisonDataItem>();
    for (const r of results) {
      if (!byDistrict.has(r.districtId)) {
        byDistrict.set(r.districtId, { label: r.districtName });
      }
      byDistrict.get(r.districtId)![r.cropId] = r.production;
    }
    return Array.from(byDistrict.values());
  }, [selectedCrops, selectedDistricts, season, year, dataVersion]);

  // Comparison table data
  const tableData = useMemo(() => {
    if (selectedCrops.length === 0 || selectedDistricts.length === 0) return [];
    return compareCrops(selectedCrops, selectedDistricts, season, year);
  }, [selectedCrops, selectedDistricts, season, year, dataVersion]);

  // Year-over-year trend for selected crops in first selected district
  const trendData = useMemo(() => {
    if (selectedCrops.length === 0 || selectedDistricts.length === 0) return [];
    const districtId = selectedDistricts[0];
    return years.map((y) => {
      const item: Record<string, string | number> = { year: String(y) };
      for (const cropId of selectedCrops) {
        const results = compareCrops([cropId], [districtId], season, y);
        item[cropId] = results[0]?.production ?? 0;
      }
      return item;
    });
  }, [selectedCrops, selectedDistricts, season, dataVersion]);

  return (
    <div>
      {/* Selection panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
        {/* Crop selection */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Select Crops (up to 4) — Hitamo ibihingwa
          </h3>
          <div className="flex flex-wrap gap-2">
            {crops.map((crop) => {
              const selected = selectedCrops.includes(crop.id);
              return (
                <button
                  key={crop.id}
                  onClick={() => toggleCrop(crop.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    selected
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-primary-400'
                  }`}
                >
                  {selected && <Check className="w-4 h-4" />}
                  <span
                    className="w-3 h-3 rounded-full inline-block"
                    style={{ backgroundColor: crop.color }}
                  />
                  {crop.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* District selection */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Select Districts (up to 4) — Hitamo uturere
          </h3>
          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
            {districts.map((d) => {
              const selected = selectedDistricts.includes(d.id);
              return (
                <button
                  key={d.id}
                  onClick={() => toggleDistrict(d.id)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                    selected
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-primary-400'
                  }`}
                >
                  {selected && <Check className="w-3.5 h-3.5" />}
                  {d.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Season & Year selectors */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4 mb-4 sm:mb-6">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex flex-col">
            <label className="text-xs text-gray-500 font-medium mb-1">Season / Igihe</label>
            <div className="flex rounded-lg overflow-hidden border border-gray-300">
              {(['A', 'B', 'C'] as Season[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSeason(s)}
                  className={`px-4 py-2 text-sm font-medium ${
                    season === s ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Season {s}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-gray-500 font-medium mb-1">Year / Umwaka</label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {selectedCrops.length === 0 || selectedDistricts.length === 0 ? (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center text-gray-500">
          Select at least one crop and one district to see the comparison.
        </div>
      ) : (
        <>
          {/* Comparison chart */}
          <div className="mb-6">
            <ComparisonChart data={chartData} selectedCropIds={selectedCrops} />
          </div>

          {/* Year trend chart for first selected district */}
          {selectedDistricts.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-5 mb-4 sm:mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">
                Year-over-Year Trend — {districts.find((d) => d.id === selectedDistricts[0])?.name ?? ''}
              </h3>
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="year" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <Tooltip
                      formatter={(value) => [Number(value).toLocaleString() + ' t', '']}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    {selectedCrops.map((cropId) => {
                      const crop = crops.find((c) => c.id === cropId);
                      return (
                        <Line
                          key={cropId}
                          type="monotone"
                          dataKey={cropId}
                          name={crop?.name ?? cropId}
                          stroke={crop?.color ?? '#16a34a'}
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Comparison table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-5 overflow-x-auto">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">
              Comparison Table — Season {season} {year}
            </h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">District</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Crop</th>
                  <th className="text-right py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Production (t)</th>
                  <th className="text-right py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Area (ha)</th>
                  <th className="text-right py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Yield (t/ha)</th>
                </tr>
              </thead>
              <tbody>
                {tableData.map((row, i) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 dark:bg-gray-700">
                    <td className="py-2 px-3 text-gray-700">{row.districtName}</td>
                    <td className="py-2 px-3">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: crops.find((c) => c.id === row.cropId)?.color }}
                        />
                        {row.cropName}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-medium text-gray-900 dark:text-white">
                      {formatNumber(row.production)}
                    </td>
                    <td className="py-2 px-3 text-right text-gray-600">
                      {formatNumber(row.area)}
                    </td>
                    <td className="py-2 px-3 text-right text-gray-600">{row.yieldPerHa}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
