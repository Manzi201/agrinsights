import { useState, useMemo } from 'react';
import type { Season } from '../types/agriculture';
import { crops, districts, getAvailableYears, getLatestYear, getAllData } from '../services/agricultureData';
import { compareCrops, formatNumber } from '../utils/calculations';
import ComparisonChart from '../components/charts/ComparisonChart';
import type { ComparisonDataItem } from '../components/charts/ComparisonChart';
import { useDataVersion } from '../hooks/useAgricultureData';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Check } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function CropComparison() {
  const dataVersion = useDataVersion();
  const { isDark } = useTheme();

  // Dynamic year from store — only years with real data
  const availableYears = getAvailableYears();
  const latestYear     = getLatestYear();
  const [season, setSeason]   = useState<Season>('A');
  const [year, setYear]       = useState<number>(() => getLatestYear());

  // Keep year in sync with available years when data loads
  const safeYear = availableYears.includes(year) ? year : latestYear;

  // Default selected crops = first two crops that have data in store
  const cropsWithData = useMemo(() => {
    const data = getAllData();
    const ids  = new Set(data.map((dp) => dp.cropId));
    return crops.filter((c) => ids.has(c.id));
  }, [dataVersion]);

  const [selectedCrops, setSelectedCrops] = useState<string[]>(() => {
    const data = getAllData();
    const ids  = [...new Set(data.map((dp) => dp.cropId))];
    return ids.slice(0, 2);
  });
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>(['musanze', 'nyagatare']);

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

  const cs = {
    grid: isDark ? '#374151' : '#e5e7eb',
    axis: isDark ? '#6b7280' : '#9ca3af',
    tt: {
      borderRadius: '8px',
      border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
      fontSize: '12px',
      backgroundColor: isDark ? '#1f2937' : '#fff',
      color: isDark ? '#f3f4f6' : '#111827',
    },
  };

  // Comparison data for chart
  const chartData = useMemo<ComparisonDataItem[]>(() => {
    if (selectedCrops.length === 0 || selectedDistricts.length === 0) return [];
    const results = compareCrops(selectedCrops, selectedDistricts, season, safeYear);
    const byDistrict = new Map<string, ComparisonDataItem>();
    for (const r of results) {
      if (!byDistrict.has(r.districtId)) byDistrict.set(r.districtId, { label: r.districtName });
      byDistrict.get(r.districtId)![r.cropId] = r.production;
    }
    return Array.from(byDistrict.values());
  }, [selectedCrops, selectedDistricts, season, safeYear, dataVersion]);

  const tableData = useMemo(() => {
    if (selectedCrops.length === 0 || selectedDistricts.length === 0) return [];
    return compareCrops(selectedCrops, selectedDistricts, season, safeYear);
  }, [selectedCrops, selectedDistricts, season, safeYear, dataVersion]);

  // Trend for first selected district
  const trendData = useMemo(() => {
    if (selectedCrops.length === 0 || selectedDistricts.length === 0) return [];
    const districtId = selectedDistricts[0];
    return availableYears.map((y) => {
      const item: Record<string, string | number> = { year: String(y) };
      for (const cropId of selectedCrops) {
        const results = compareCrops([cropId], [districtId], season, y);
        item[cropId] = results[0]?.production ?? 0;
      }
      return item;
    });
  }, [selectedCrops, selectedDistricts, season, dataVersion, availableYears]);

  const selectCls = 'rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500';

  return (
    <div>
      {/* Selection panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
        {/* Crop selection — shows ALL crops from NISR store */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-5">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">
            Select Crops (up to 4)
          </h3>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
            {cropsWithData.length} crops available from NISR data
          </p>
          <div className="flex flex-wrap gap-2 max-h-44 overflow-y-auto">
            {cropsWithData.map((crop) => {
              const selected = selectedCrops.includes(crop.id);
              return (
                <button
                  key={crop.id}
                  onClick={() => toggleCrop(crop.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    selected
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:border-primary-400 dark:hover:border-primary-500'
                  }`}
                >
                  {selected && <Check className="w-3 h-3" />}
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: crop.color }} />
                  {crop.name}
                </button>
              );
            })}
            {cropsWithData.length === 0 && (
              <p className="text-xs text-gray-400 dark:text-gray-500 py-4">
                Loading crop data from NISR…
              </p>
            )}
          </div>
        </div>

        {/* District selection */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-5">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
            Select Districts (up to 4)
          </h3>
          <div className="flex flex-wrap gap-2 max-h-44 overflow-y-auto">
            {districts.map((d) => {
              const selected = selectedDistricts.includes(d.id);
              return (
                <button
                  key={d.id}
                  onClick={() => toggleDistrict(d.id)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border transition-colors ${
                    selected
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:border-primary-400'
                  }`}
                >
                  {selected && <Check className="w-3 h-3" />}
                  {d.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Season & Year — only available years shown */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4 mb-4 sm:mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-col">
            <label className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">Season</label>
            <div className="flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
              {(['A', 'B', 'C'] as Season[]).map((s) => (
                <button key={s} onClick={() => setSeason(s)}
                  className={`px-4 py-2 text-sm font-medium ${
                    season === s ? 'bg-primary-600 text-white' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">Year</label>
            <select value={safeYear} onChange={(e) => setYear(Number(e.target.value))} className={selectCls}>
              {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          {availableYears.length === 1 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-4">
              Only {availableYears[0]} data available from NISR
            </p>
          )}
        </div>
      </div>

      {selectedCrops.length === 0 || selectedDistricts.length === 0 ? (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center text-gray-500 dark:text-gray-400 text-sm">
          Select at least one crop and one district to see the comparison.
        </div>
      ) : (
        <>
          {/* Bar chart comparison */}
          <div className="mb-4 sm:mb-6">
            <ComparisonChart data={chartData} selectedCropIds={selectedCrops} />
          </div>

          {/* Year-over-year trend — only shown when multiple years exist */}
          {availableYears.length > 1 && selectedDistricts.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 mb-4 sm:mb-6">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">
                Year-over-Year Trend — {districts.find((d) => d.id === selectedDistricts[0])?.name}
              </h3>
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={cs.grid} />
                    <XAxis dataKey="year" tick={{ fontSize: 12, fill: cs.axis }} stroke={cs.axis} />
                    <YAxis tick={{ fontSize: 12, fill: cs.axis }} stroke={cs.axis} />
                    <Tooltip formatter={(v) => [Number(v).toLocaleString() + ' t', '']} contentStyle={cs.tt} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    {selectedCrops.map((cropId) => {
                      const crop = crops.find((c) => c.id === cropId);
                      return (
                        <Line key={cropId} type="monotone" dataKey={cropId}
                          name={crop?.name ?? cropId} stroke={crop?.color ?? '#16a34a'}
                          strokeWidth={2} dot={{ r: 3 }} />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Comparison table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 overflow-x-auto">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">
              Comparison Table — Season {season} {safeYear}
            </h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-gray-300">District</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-gray-300">Crop</th>
                  <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-300">Production (t)</th>
                  <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-300">Area (ha)</th>
                  <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-300">Yield (t/ha)</th>
                </tr>
              </thead>
              <tbody>
                {tableData.length === 0 ? (
                  <tr><td colSpan={5} className="py-6 text-center text-gray-400 dark:text-gray-500 text-xs">
                    No data for the selected combination. NISR may not have data for all crops in all districts.
                  </td></tr>
                ) : tableData.map((row, i) => (
                  <tr key={i} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/40">
                    <td className="py-2 px-3 text-gray-700 dark:text-gray-200">{row.districtName}</td>
                    <td className="py-2 px-3">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: crops.find((c) => c.id === row.cropId)?.color }} />
                        {row.cropName}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-medium text-gray-900 dark:text-white">{formatNumber(row.production)}</td>
                    <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-300">{formatNumber(row.area)}</td>
                    <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-300">{row.yieldPerHa}</td>
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
