import { useState, useMemo } from 'react';
import { useFilters, useDataVersion } from '../hooks/useAgricultureData';
import FilterBar from '../components/ui/FilterBar';
import RwandaMap from '../components/map/RwandaMap';
import AIAnalysisPanel from '../components/ui/AIAnalysisPanel';
import { getCropById, districts } from '../services/agricultureData';
import { getProductionByDistrict } from '../utils/calculations';
import { getTopDistricts, getPracticeData } from '../services/nisr';
import { Droplets } from 'lucide-react';

export default function AgriMap() {
  const { cropId, season, year, setCropId, setSeason, setYear } = useFilters();
  const dataVersion = useDataVersion();
  const crop = getCropById(cropId);
  const [selectedDistrictId, setSelectedDistrictId] = useState<string | null>(null);
  const [showIrrigation, setShowIrrigation] = useState(false);

  // Irrigation data per district from practice store
  const irrigationByDistrict = useMemo(() => {
    const pd = getPracticeData();
    if (pd.length === 0) return new Map<string, number>();
    const map = new Map<string, number>();
    for (const p of pd.filter((x) => x.practice === 'Modern irrigated land')) {
      map.set(p.districtId, (map.get(p.districtId) ?? 0) + p.areaHa);
    }
    return map;
  }, [dataVersion]);

  const hasIrrigationData = irrigationByDistrict.size > 0;

  const aiInput = useMemo(() => {
    if (!selectedDistrictId) return null;
    const byDistrict = getProductionByDistrict(cropId, season, year);
    const districtData = byDistrict.get(selectedDistrictId);
    const district = districts.find((d) => d.id === selectedDistrictId);
    const allValues = Array.from(byDistrict.values());
    const natAvgYield = allValues.length > 0
      ? allValues.reduce((s, d) => s + d.yieldPerHa, 0) / allValues.length : 0;
    const topDists = getTopDistricts(cropId, season, year, 1);
    const prevByDistrict = getProductionByDistrict(cropId, season, year - 1);
    const prevData = prevByDistrict.get(selectedDistrictId);

    return {
      districtName: district?.name ?? selectedDistrictId,
      province: district?.province ?? '',
      cropName: crop?.name ?? cropId,
      season,
      year,
      production: districtData?.production ?? 0,
      area: districtData?.area ?? 0,
      yieldPerHa: districtData?.yieldPerHa ?? 0,
      nationalAvgYield: Math.round(natAvgYield * 100) / 100,
      previousYearProduction: prevData?.production,
      topDistrict: topDists[0]
        ? { name: topDists[0].districtName, production: topDists[0].production }
        : undefined,
    };
  }, [selectedDistrictId, cropId, season, year, dataVersion]);

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

      <div className="mb-3 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg p-3 text-xs sm:text-sm text-primary-800 dark:text-primary-200">
        Showing <strong>{crop?.name ?? 'Maize'}</strong> · Season <strong>{season} {year}</strong>.
        Click a district circle to view production details and district report.
      </div>

      {/* Irrigation coverage toggle */}
      <div className="flex items-center gap-3 mb-3">
        {hasIrrigationData ? (
          <button
            onClick={() => setShowIrrigation((prev) => !prev)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
              showIrrigation
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <Droplets className="w-4 h-4" />
            {showIrrigation ? 'Showing Irrigation Coverage' : 'Show Irrigation Coverage'}
          </button>
        ) : (
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 cursor-not-allowed"
            title="Irrigation data loading..."
          >
            <Droplets className="w-4 h-4" />
            Irrigation data loading...
          </div>
        )}
      </div>

      <RwandaMap
        cropId={cropId}
        season={season}
        year={year}
        cropName={crop?.name ?? 'Maize'}
        onDistrictClick={setSelectedDistrictId}
        irrigationMode={showIrrigation}
        irrigationData={irrigationByDistrict}
      />

      {/* District report shown when a district is clicked */}
      {aiInput && (
        <div className="mt-4">
          <AIAnalysisPanel input={aiInput} />
        </div>
      )}
    </div>
  );
}
