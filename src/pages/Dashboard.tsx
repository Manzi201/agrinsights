import { useMemo, useState } from 'react';
import { LandPlot, Sprout, TrendingUp, Package, Droplets } from 'lucide-react';
import { useFilters, useAgricultureData, useDataVersion } from '../hooks/useAgricultureData';
import FilterBar from '../components/ui/FilterBar';
import StatCard from '../components/ui/StatCard';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ProductionTrendChart from '../components/charts/ProductionTrendChart';
import DistrictBarChart from '../components/charts/DistrictBarChart';
import CropShareChart from '../components/charts/CropShareChart';
import AIAnalysisPanel from '../components/ui/AIAnalysisPanel';
import {
  getProductionTrend,
  getTopDistricts,
  getCropShareByCategory,
  getHarvestData,
  getPracticeData,
} from '../services/nisr';
import { getCropById, districts } from '../services/agricultureData';
import { formatNumber, getProductionByDistrict } from '../utils/calculations';
import { useTheme } from '../context/ThemeContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';

export default function Dashboard() {
  const { filters, cropId, season, year, setCropId, setSeason, setYear } = useFilters();
  const { stats, loading } = useAgricultureData(filters);
  const dataVersion = useDataVersion();
  const [selectedDistrict, setSelectedDistrict] = useState<string>('musanze');
  const { isDark } = useTheme();

  const crop = getCropById(cropId);
  const cropColor = crop?.color ?? '#16a34a';
  const cropName = crop?.name ?? 'Maize';

  const trendData = useMemo(() => getProductionTrend(cropId, season), [cropId, season, dataVersion]);
  const topDistricts = useMemo(() => getTopDistricts(cropId, season, year, 10), [cropId, season, year, dataVersion]);
  const cropShare = useMemo(() => getCropShareByCategory(season, year), [season, year, dataVersion]);

  // Harvest efficiency stat
  const harvestEff = useMemo(() => {
    const hd = getHarvestData();
    if (hd.length === 0) return null;
    const avg = hd.reduce((s, p) => s + p.harvestRatio, 0) / hd.length;
    return Math.round(avg * 10) / 10;
  }, [dataVersion]);

  // Districts with irrigation stat
  const irrigatedDistricts = useMemo(() => {
    const pd = getPracticeData();
    if (pd.length === 0) return null;
    const ids = new Set(
      pd.filter((p) => p.practice === 'Modern irrigated land' && p.areaHa > 0).map((p) => p.districtId),
    );
    return ids.size;
  }, [dataVersion]);

  // Harvest efficiency by crop (horizontal bar chart)
  const harvestByCrop = useMemo(() => {
    const hd = getHarvestData();
    if (hd.length === 0) return [];
    const map = new Map<string, number[]>();
    for (const p of hd) {
      if (!map.has(p.cropName)) map.set(p.cropName, []);
      map.get(p.cropName)!.push(p.harvestRatio);
    }
    return Array.from(map.entries())
      .map(([name, vals]) => ({
        name,
        ratio: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10,
      }))
      .sort((a, b) => b.ratio - a.ratio);
  }, [dataVersion]);

  // Agricultural practices national totals
  const practiceNatTotals = useMemo(() => {
    const pd = getPracticeData();
    if (pd.length === 0) return [];
    const map = new Map<string, number>();
    for (const p of pd) map.set(p.practice, (map.get(p.practice) ?? 0) + p.areaHa);
    return Array.from(map.entries()).map(([practice, areaHa]) => ({ practice, areaHa }));
  }, [dataVersion]);

  const chartColors = {
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

  // Prepare AI analysis input for selected district
  const aiInput = useMemo(() => {
    const byDistrict = getProductionByDistrict(cropId, season, year);
    const districtData = byDistrict.get(selectedDistrict);
    const district = districts.find((d) => d.id === selectedDistrict);

    const allDistricts = Array.from(byDistrict.values());
    const natAvgYield = allDistricts.length > 0
      ? allDistricts.reduce((s, d) => s + d.yieldPerHa, 0) / allDistricts.length
      : 0;

    const topDist = topDistricts[0];

    // Previous year
    const prevByDistrict = getProductionByDistrict(cropId, season, year - 1);
    const prevData = prevByDistrict.get(selectedDistrict);

    return {
      districtName: district?.name ?? selectedDistrict,
      province: district?.province ?? '',
      cropName,
      season,
      year,
      production: districtData?.production ?? 0,
      area: districtData?.area ?? 0,
      yieldPerHa: districtData?.yieldPerHa ?? 0,
      nationalAvgYield: Math.round(natAvgYield * 100) / 100,
      previousYearProduction: prevData?.production,
      topDistrict: topDist ? { name: topDist.districtName, production: topDist.production } : undefined,
    };
  }, [cropId, season, year, selectedDistrict, topDistricts, dataVersion]);

  if (loading && !stats) {
    return <LoadingSpinner message="Loading dashboard data..." />;
  }

  return (
    <div>
      <FilterBar
        cropId={cropId}
        season={season}
        year={year}
        onCropChange={setCropId}
        onSeasonChange={setSeason}
        onYearChange={setYear}
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <StatCard
          label="Cultivated Area"
          value={stats ? formatNumber(stats.totalArea) : '—'}
          unit="ha"
          icon={<LandPlot className="w-5 h-5 sm:w-6 sm:h-6" />}
          color="primary"
        />
        <StatCard
          label="Total Production"
          value={stats ? formatNumber(stats.totalProduction) : '—'}
          unit="t"
          icon={<Sprout className="w-5 h-5 sm:w-6 sm:h-6" />}
          changePercent={stats?.yearChangePercent}
          changeLabel={`vs ${year - 1}`}
          color="primary"
        />
        <StatCard
          label="Avg Yield"
          value={stats ? stats.averageYield.toString() : '—'}
          unit="t/ha"
          icon={<TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />}
          color="blue"
        />
        <StatCard
          label="Harvest Efficiency"
          value={harvestEff !== null ? harvestEff.toString() : '—'}
          unit="%"
          icon={<Package className="w-5 h-5 sm:w-6 sm:h-6" />}
          color="amber"
        />
        <StatCard
          label="Districts w/ Irrigation"
          value={irrigatedDistricts !== null ? irrigatedDistricts.toString() : '—'}
          unit="districts"
          icon={<Droplets className="w-5 h-5 sm:w-6 sm:h-6" />}
          color="blue"
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
        <ProductionTrendChart data={trendData} cropName={cropName} cropColor={cropColor} />
        <CropShareChart data={cropShare} />
      </div>

      {/* Charts row 2 */}
      <div className="mb-4 sm:mb-6">
        <DistrictBarChart data={topDistricts} cropName={cropName} />
      </div>

      {/* Harvest Efficiency by Crop */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-4 sm:mb-6">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Harvest Efficiency by Crop</h3>
        {harvestByCrop.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">Harvest data loading...</p>
        ) : (
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={harvestByCrop} margin={{ top: 5, right: 40, bottom: 5, left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: chartColors.axis }}
                  stroke={chartColors.axis}
                  tickFormatter={(v) => `${v}%`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11, fill: chartColors.axis }}
                  stroke={chartColors.axis}
                  width={75}
                />
                <Tooltip
                  contentStyle={chartColors.tt}
                  formatter={(v) => [`${v}%`, 'Avg Harvest Ratio']}
                />
                <Bar dataKey="ratio" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Agricultural Practices */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-4 sm:mb-6">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Agricultural Practices — National Coverage (ha)</h3>
        {practiceNatTotals.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">Practices data loading...</p>
        ) : (
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={practiceNatTotals} margin={{ top: 5, right: 20, bottom: 60, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                <XAxis
                  dataKey="practice"
                  tick={{ fontSize: 10, fill: chartColors.axis }}
                  stroke={chartColors.axis}
                  angle={-20}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: chartColors.axis }}
                  stroke={chartColors.axis}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={chartColors.tt}
                  formatter={(v) => [formatNumber(v as number) + ' ha', 'Area']}
                />
                <Bar dataKey="areaHa" fill="#16a34a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* District Analysis panel */}
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <label className="text-xs font-semibold text-gray-600">District Report</label>
          <select
            value={selectedDistrict}
            onChange={(e) => setSelectedDistrict(e.target.value)}
            className="px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {districts.map((d) => (
              <option key={d.id} value={d.id}>{d.name} ({d.province})</option>
            ))}
          </select>
        </div>
        <AIAnalysisPanel input={aiInput} />
      </div>
    </div>
  );
}
