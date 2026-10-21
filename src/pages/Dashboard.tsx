import { useMemo, useState } from 'react';
import { LandPlot, Sprout, TrendingUp, Layers } from 'lucide-react';
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
} from '../services/nisr';
import { getCropById, districts } from '../services/agricultureData';
import { formatNumber, getProductionByDistrict } from '../utils/calculations';

export default function Dashboard() {
  const { filters, cropId, season, year, setCropId, setSeason, setYear } = useFilters();
  const { stats, loading } = useAgricultureData(filters);
  const dataVersion = useDataVersion();
  const [selectedDistrict, setSelectedDistrict] = useState<string>('musanze');

  const crop = getCropById(cropId);
  const cropColor = crop?.color ?? '#16a34a';
  const cropName = crop?.name ?? 'Maize';

  const trendData = useMemo(() => getProductionTrend(cropId, season), [cropId, season, dataVersion]);
  const topDistricts = useMemo(() => getTopDistricts(cropId, season, year, 10), [cropId, season, year, dataVersion]);
  const cropShare = useMemo(() => getCropShareByCategory(season, year), [season, year, dataVersion]);

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
          label="Crops Tracked"
          value={stats ? stats.cropCount.toString() : '—'}
          icon={<Layers className="w-5 h-5 sm:w-6 sm:h-6" />}
          color="purple"
        />
        <StatCard
          label="Year Change"
          value={stats ? `${stats.yearChangePercent > 0 ? '+' : ''}${stats.yearChangePercent}%` : '—'}
          icon={<TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />}
          color={stats && stats.yearChangePercent >= 0 ? 'primary' : 'red'}
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
