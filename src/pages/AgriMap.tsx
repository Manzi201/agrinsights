import { useState, useMemo } from 'react';
import { useFilters, useDataVersion } from '../hooks/useAgricultureData';
import FilterBar from '../components/ui/FilterBar';
import RwandaMap from '../components/map/RwandaMap';
import AIAnalysisPanel from '../components/ui/AIAnalysisPanel';
import { getCropById, districts } from '../services/agricultureData';
import { getProductionByDistrict } from '../utils/calculations';
import { getTopDistricts } from '../services/nisr';

export default function AgriMap() {
  const { cropId, season, year, setCropId, setSeason, setYear } = useFilters();
  const dataVersion = useDataVersion();
  const crop = getCropById(cropId);
  const [selectedDistrictId, setSelectedDistrictId] = useState<string | null>(null);

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

      <RwandaMap
        cropId={cropId}
        season={season}
        year={year}
        cropName={crop?.name ?? 'Maize'}
        onDistrictClick={setSelectedDistrictId}
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
