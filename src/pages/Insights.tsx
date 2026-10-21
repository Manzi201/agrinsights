import { useState, useMemo } from 'react';
import type { Season, InsightType } from '../types/agriculture';
import { crops, years, districts } from '../services/agricultureData';
import { generateInsights, getProductionByDistrict } from '../utils/calculations';
import { getTopDistricts } from '../services/nisr';
import InsightCard from '../components/ui/InsightCard';
import AIAnalysisPanel from '../components/ui/AIAnalysisPanel';
import { useDataVersion } from '../hooks/useAgricultureData';
import { Lightbulb, Filter } from 'lucide-react';

export default function Insights() {
  const [cropId, setCropId] = useState('maize');
  const [season, setSeason] = useState<Season>('A');
  const [year, setYear] = useState(2024);
  const [severityFilter, setSeverityFilter] = useState<InsightType | 'all'>('all');
  const [aiDistrictId, setAiDistrictId] = useState('musanze');
  const dataVersion = useDataVersion();

  const insights = useMemo(
    () => generateInsights(cropId, season, year),
    [cropId, season, year, dataVersion],
  );

  const filteredInsights = useMemo(() => {
    if (severityFilter === 'all') return insights;
    return insights.filter((i) => i.type === severityFilter);
  }, [insights, severityFilter]);

  const severityCounts = useMemo(() => {
    const counts: Record<string, number> = { critical: 0, warning: 0, positive: 0, info: 0 };
    for (const i of insights) counts[i.type] = (counts[i.type] ?? 0) + 1;
    return counts;
  }, [insights]);

  const aiInput = useMemo(() => {
    const byDistrict = getProductionByDistrict(cropId, season, year);
    const districtData = byDistrict.get(aiDistrictId);
    const district = districts.find((d) => d.id === aiDistrictId);
    const allValues = Array.from(byDistrict.values());
    const natAvgYield = allValues.length > 0
      ? allValues.reduce((s, d) => s + d.yieldPerHa, 0) / allValues.length : 0;
    const topDists = getTopDistricts(cropId, season, year, 1);
    const prevByDistrict = getProductionByDistrict(cropId, season, year - 1);
    const prevData = prevByDistrict.get(aiDistrictId);
    return {
      districtName: district?.name ?? aiDistrictId,
      province: district?.province ?? '',
      cropName: crops.find((c) => c.id === cropId)?.name ?? cropId,
      season, year,
      production: districtData?.production ?? 0,
      area: districtData?.area ?? 0,
      yieldPerHa: districtData?.yieldPerHa ?? 0,
      nationalAvgYield: Math.round(natAvgYield * 100) / 100,
      previousYearProduction: prevData?.production,
      topDistrict: topDists[0]
        ? { name: topDists[0].districtName, production: topDists[0].production } : undefined,
    };
  }, [aiDistrictId, cropId, season, year, dataVersion]);

  return (
    <div>
      {/* Filter bar */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4 mb-4 sm:mb-6">
        <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-gray-700">
          <Filter className="w-4 h-4" /> Filters
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col flex-1 min-w-[140px]">
            <label className="text-xs text-gray-500 font-medium mb-1">Crop</label>
            <select value={cropId} onChange={(e) => setCropId(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 w-full">
              {crops.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-gray-500 font-medium mb-1">Season</label>
            <div className="flex rounded-lg overflow-hidden border border-gray-300">
              {(['A', 'B', 'C'] as Season[]).map((s) => (
                <button key={s} onClick={() => setSeason(s)}
                  className={`px-3 py-2 text-sm font-medium ${season === s ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-gray-500 font-medium mb-1">Year</label>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-gray-500 font-medium mb-1">Severity</label>
            <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value as InsightType | 'all')}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option value="all">All</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
              <option value="positive">Positive</option>
              <option value="info">Info</option>
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {([
            { key: 'critical', label: 'Critical', color: 'text-red-600 bg-red-50' },
            { key: 'warning', label: 'Warning', color: 'text-amber-600 bg-amber-50' },
            { key: 'positive', label: 'Positive', color: 'text-green-600 bg-green-50' },
            { key: 'info', label: 'Info', color: 'text-blue-600 bg-blue-50' },
          ] as const).map((s) => (
            <div key={s.key} className={`px-2 py-1 rounded-lg text-xs font-medium ${s.color}`}>
              {s.label}: {severityCounts[s.key] ?? 0}
            </div>
          ))}
        </div>
      </div>

      {/* Insights */}
      <div className="mb-3 flex items-center gap-2 text-gray-700">
        <Lightbulb className="w-4 h-4 text-primary-600 flex-shrink-0" />
        <span className="text-sm font-semibold">
          {filteredInsights.length} insight{filteredInsights.length !== 1 ? 's' : ''} —{' '}
          {crops.find((c) => c.id === cropId)?.name}, Season {season} {year}
        </span>
      </div>

      {filteredInsights.length === 0 ? (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 p-10 text-center text-gray-500 text-sm mb-6">
          No insights found. Try changing the crop, season, or year.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 mb-6">
          {filteredInsights.map((insight) => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
        </div>
      )}

      {/* District Deep Dive section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-primary-600" />
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Detailed District Report</span>
          </div>
          <select
            value={aiDistrictId}
            onChange={(e) => setAiDistrictId(e.target.value)}
            className="flex-1 min-w-[160px] px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {districts.map((d) => (
              <option key={d.id} value={d.id}>{d.name} ({d.province})</option>
            ))}
          </select>
        </div>
        <AIAnalysisPanel input={aiInput} />
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 sm:p-4 text-xs sm:text-sm text-blue-800 dark:text-blue-300">
        Insights are generated from NISR Rwanda agricultural data and reflect actual production figures including cultivated area, output, and yield per hectare. Reported findings do not assume the cause of a change without supporting data.
      </div>
    </div>
  );
}
