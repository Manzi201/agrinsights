import { useMemo } from 'react';
import {
  Droplets, Leaf, Package, TrendingUp, Globe,
  AlertTriangle, CheckCircle2, ArrowRight, BarChart2,
} from 'lucide-react';
import { getAllData, crops, districts } from '../services/agricultureData';
import { formatNumber } from '../utils/calculations';
import { useDataVersion } from '../hooks/useAgricultureData';

// ---------------------------------------------------------------------------
// Helper: derive data-driven stats for each solution area
// ---------------------------------------------------------------------------

function useIrrigationData() {
  const data = getAllData();
  // Districts with lowest Season C production (dry season) — irrigation need signal
  const seasonC = data.filter((dp) => dp.season === 'C' && dp.year === 2023);
  const seasonA = data.filter((dp) => dp.season === 'A' && dp.year === 2023);

  const districtC = new Map<string, number>();
  const districtA = new Map<string, number>();
  for (const dp of seasonC) districtC.set(dp.districtId, (districtC.get(dp.districtId) ?? 0) + dp.production);
  for (const dp of seasonA) districtA.set(dp.districtId, (districtA.get(dp.districtId) ?? 0) + dp.production);

  const irrigationGap = districts
    .filter((d) => districtA.get(d.id) && districtC.get(d.id))
    .map((d) => ({
      name: d.name,
      province: d.province,
      seasonA: districtA.get(d.id) ?? 0,
      seasonC: districtC.get(d.id) ?? 0,
      gap: ((districtA.get(d.id) ?? 0) - (districtC.get(d.id) ?? 0)),
    }))
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 5);

  return { irrigationGap };
}

function useSoilData() {
  const data = getAllData();
  // Districts with consistently low yield vs national average — soil fertility signal
  const year2023 = data.filter((dp) => dp.season === 'A' && dp.year === 2023);
  const year2019 = data.filter((dp) => dp.season === 'A' && dp.year === 2019);

  const yieldByDistrict2023 = new Map<string, number[]>();
  const yieldByDistrict2019 = new Map<string, number[]>();

  for (const dp of year2023) {
    if (!yieldByDistrict2023.has(dp.districtId)) yieldByDistrict2023.set(dp.districtId, []);
    yieldByDistrict2023.get(dp.districtId)!.push(dp.yieldPerHa);
  }
  for (const dp of year2019) {
    if (!yieldByDistrict2019.has(dp.districtId)) yieldByDistrict2019.set(dp.districtId, []);
    yieldByDistrict2019.get(dp.districtId)!.push(dp.yieldPerHa);
  }

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

  const soilDistricts = districts
    .filter((d) => yieldByDistrict2023.has(d.id) && yieldByDistrict2019.has(d.id))
    .map((d) => ({
      name: d.name,
      province: d.province,
      yield2019: Math.round(avg(yieldByDistrict2019.get(d.id)!) * 100) / 100,
      yield2023: Math.round(avg(yieldByDistrict2023.get(d.id)!) * 100) / 100,
      change: Math.round(((avg(yieldByDistrict2023.get(d.id)!) - avg(yieldByDistrict2019.get(d.id)!)) / avg(yieldByDistrict2019.get(d.id)!)) * 1000) / 10,
    }))
    .sort((a, b) => a.change - b.change)
    .slice(0, 5);

  return { soilDistricts };
}

function usePostHarvestData() {
  const data = getAllData();
  // Crops with highest production but low value-added potential = post-harvest opportunity
  const totalByCrop = new Map<string, { production: number; area: number }>();
  for (const dp of data.filter((dp) => dp.year === 2023)) {
    const existing = totalByCrop.get(dp.cropId) ?? { production: 0, area: 0 };
    existing.production += dp.production;
    existing.area += dp.area;
    totalByCrop.set(dp.cropId, existing);
  }

  const cropSummary = crops.map((c) => ({
    name: c.name,
    category: c.category,
    color: c.color,
    production: Math.round(totalByCrop.get(c.id)?.production ?? 0),
    area: Math.round(totalByCrop.get(c.id)?.area ?? 0),
  }))
  .filter((c) => c.production > 0)
  .sort((a, b) => b.production - a.production);

  return { cropSummary };
}

function useProductivityData() {
  const data = getAllData();
  // Year-over-year yield growth by crop (2019→2023)
  const yieldByCrop2019 = new Map<string, number[]>();
  const yieldByCrop2023 = new Map<string, number[]>();

  for (const dp of data.filter((dp) => dp.season === 'A')) {
    if (dp.year === 2019) {
      if (!yieldByCrop2019.has(dp.cropId)) yieldByCrop2019.set(dp.cropId, []);
      yieldByCrop2019.get(dp.cropId)!.push(dp.yieldPerHa);
    }
    if (dp.year === 2023) {
      if (!yieldByCrop2023.has(dp.cropId)) yieldByCrop2023.set(dp.cropId, []);
      yieldByCrop2023.get(dp.cropId)!.push(dp.yieldPerHa);
    }
  }

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

  const cropGrowth = crops
    .filter((c) => yieldByCrop2019.has(c.id) && yieldByCrop2023.has(c.id))
    .map((c) => {
      const y19 = avg(yieldByCrop2019.get(c.id)!);
      const y23 = avg(yieldByCrop2023.get(c.id)!);
      return {
        name: c.name,
        color: c.color,
        yield2019: Math.round(y19 * 100) / 100,
        yield2023: Math.round(y23 * 100) / 100,
        growthPct: Math.round(((y23 - y19) / y19) * 1000) / 10,
      };
    })
    .sort((a, b) => b.growthPct - a.growthPct);

  return { cropGrowth };
}

function useExportData() {
  const data = getAllData();
  // High-value export crops: Irish Potato, Wheat, Rice — top producing districts
  const exportCrops = ['irish-potato', 'wheat', 'rice'];
  const exportByDistrict = new Map<string, number>();

  for (const dp of data.filter((dp) => dp.year === 2023 && dp.season === 'A' && exportCrops.includes(dp.cropId))) {
    exportByDistrict.set(dp.districtId, (exportByDistrict.get(dp.districtId) ?? 0) + dp.production);
  }

  const topExportDistricts = districts
    .filter((d) => exportByDistrict.has(d.id))
    .map((d) => ({
      name: d.name,
      province: d.province,
      production: Math.round(exportByDistrict.get(d.id) ?? 0),
    }))
    .sort((a, b) => b.production - a.production)
    .slice(0, 5);

  return { topExportDistricts };
}

// ---------------------------------------------------------------------------
// Solution area card
// ---------------------------------------------------------------------------

interface SolutionAreaProps {
  icon: React.ReactNode;
  color: string;
  title: string;
  challenge: string;
  solution: string;
  dataInsight: React.ReactNode;
  recommendations: string[];
}

function SolutionArea({ icon, color, title, challenge, solution, dataInsight, recommendations }: SolutionAreaProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className={`px-5 py-4 ${color} flex items-center gap-3`}>
        <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
        <h3 className="text-base font-bold text-white">{title}</h3>
      </div>

      <div className="p-5 space-y-4">
        {/* Challenge */}
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">Challenge</span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{challenge}</p>
        </div>

        {/* NISR data insight */}
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-1.5 mb-2">
            <BarChart2 className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400 flex-shrink-0" />
            <span className="text-xs font-semibold text-primary-700 dark:text-primary-400 uppercase tracking-wide">NISR Data Evidence</span>
          </div>
          {dataInsight}
        </div>

        {/* Solution */}
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
            <span className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide">How Agrinsights Helps</span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{solution}</p>
        </div>

        {/* Recommendations */}
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Recommended Actions</p>
          <ul className="space-y-1.5">
            {recommendations.map((rec, i) => (
              <li key={i} className="flex gap-2 text-xs text-gray-600 dark:text-gray-300 leading-snug">
                <ArrowRight className="w-3.5 h-3.5 text-primary-500 flex-shrink-0 mt-0.5" />
                {rec}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function Solutions() {
  const dataVersion = useDataVersion();
  const { irrigationGap } = useMemo(() => useIrrigationData(), [dataVersion]);
  const { soilDistricts } = useMemo(() => useSoilData(), [dataVersion]);
  const { cropSummary } = useMemo(() => usePostHarvestData(), [dataVersion]);
  const { cropGrowth } = useMemo(() => useProductivityData(), [dataVersion]);
  const { topExportDistricts } = useMemo(() => useExportData(), [dataVersion]);

  return (
    <div>
      {/* Page intro */}
      <div className="bg-gradient-to-r from-primary-700 to-primary-900 rounded-xl p-5 sm:p-6 mb-6 text-white">
        <h2 className="text-lg sm:text-xl font-bold mb-2">Agricultural Solutions for Rwanda</h2>
        <p className="text-sm text-primary-100 leading-relaxed max-w-3xl">
          Agrinsights uses NISR agricultural data to identify and address real farming challenges across Rwanda's 30 districts. The following solution areas are directly informed by crop production, yield, and area data from national surveys.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {['NISR Data-Driven', 'Farmer-Focused', 'Policy-Ready', 'All 30 Districts'].map((tag) => (
            <span key={tag} className="px-2.5 py-1 bg-white/20 rounded-full text-xs font-medium">{tag}</span>
          ))}
        </div>
      </div>

      {/* Solutions grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* 1. Irrigation */}
        <SolutionArea
          icon={<Droplets className="w-5 h-5 text-white" />}
          color="bg-blue-600"
          title="Small-Scale Irrigation"
          challenge="Season C (dry season) production is dramatically lower than Season A across most districts, indicating that rainfed agriculture leaves large yield gaps that irrigation could close."
          solution="Agrinsights maps the Season A–C production gap by district, pinpointing where irrigation investment would have the highest impact. Planners can prioritize districts where the gap exceeds 80% of annual potential."
          dataInsight={
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">Top 5 districts with largest Season A vs Season C production gap (2023):</p>
              <div className="space-y-1.5">
                {irrigationGap.map((d) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-200 w-24 flex-shrink-0">{d.name}</span>
                    <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-blue-500"
                        style={{ width: `${Math.min(100, (d.gap / irrigationGap[0]?.gap) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 w-24 text-right flex-shrink-0">
                      Gap: {formatNumber(d.gap)} t
                    </span>
                  </div>
                ))}
              </div>
            </div>
          }
          recommendations={[
            'Prioritize irrigation investment in districts with Season A–C gaps above 50,000 tons.',
            'Use Agrinsights district map to identify marshland areas suitable for small dam construction.',
            'Track irrigation program impact year-over-year via the Crop Comparison tool.',
          ]}
        />

        {/* 2. Soil Conservation */}
        <SolutionArea
          icon={<Leaf className="w-5 h-5 text-white" />}
          color="bg-amber-600"
          title="Soil Conservation & Fertility Management"
          challenge="Some districts show declining yield per hectare over time despite similar or larger cultivated areas, indicating soil degradation or declining soil fertility rather than insufficient land."
          solution="Agrinsights tracks yield per hectare trends by district over 7 years (2018–2024). Districts with a declining yield trend signal a need for soil conservation programs, terracing, and fertiliser support."
          dataInsight={
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">Districts with declining average yield (2019 → 2023, Season A):</p>
              <div className="space-y-1.5">
                {soilDistricts.map((d) => (
                  <div key={d.name} className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-200 w-24 flex-shrink-0">{d.name}</span>
                    <div className="flex-1 text-center">
                      <span className="text-xs text-gray-500 dark:text-gray-400">{d.yield2019} → {d.yield2023} t/ha</span>
                    </div>
                    <span className={`text-xs font-semibold w-16 text-right flex-shrink-0 ${d.change < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                      {d.change > 0 ? '+' : ''}{d.change}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          }
          recommendations={[
            'Target districts with >5% yield decline for soil health assessments and terracing programs.',
            'Use Agrinsights yield heatmap to guide fertiliser subsidy allocation.',
            'Promote crop rotation policies in low-yield districts using Crop Comparison data.',
          ]}
        />

        {/* 3. Post-Harvest */}
        <SolutionArea
          icon={<Package className="w-5 h-5 text-white" />}
          color="bg-orange-600"
          title="Post-Harvest Collection & Storage"
          challenge="High production volumes without adequate storage infrastructure lead to post-harvest losses, price crashes, and food insecurity. Rwanda produces large volumes of perishable roots and tubers."
          solution="Agrinsights identifies districts and crop types with the highest production volumes, flagging where storage deficits are most critical. Decision-makers can plan warehouse and cooperative storage investments based on actual tonnage."
          dataInsight={
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">National production by crop (2023) — storage demand indicator:</p>
              <div className="space-y-1.5">
                {cropSummary.slice(0, 5).map((c) => (
                  <div key={c.name} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-200 w-24 flex-shrink-0">{c.name}</span>
                    <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                      <div
                        className="h-2 rounded-full"
                        style={{
                          backgroundColor: c.color,
                          width: `${Math.min(100, (c.production / (cropSummary[0]?.production || 1)) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 w-24 text-right flex-shrink-0">
                      {formatNumber(c.production)} t
                    </span>
                  </div>
                ))}
              </div>
            </div>
          }
          recommendations={[
            'Build or expand storage facilities in top-producing districts for cassava and sweet potato.',
            'Use Reports page to generate district-level production forecasts for storage planning.',
            'Develop cooperative buying programs in peak Season A production months.',
          ]}
        />

        {/* 4. Productivity & Value Addition */}
        <SolutionArea
          icon={<TrendingUp className="w-5 h-5 text-white" />}
          color="bg-purple-600"
          title="Agricultural Productivity & Value Addition"
          challenge="While cultivated area has grown steadily, yield per hectare for several crops has improved slowly or stagnated, indicating that area expansion alone is not sufficient — intensification and processing are needed."
          solution="Agrinsights measures yield per hectare trends by crop and district, enabling planners to identify which crops respond best to improved inputs and where processing facilities would add the most value."
          dataInsight={
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">Yield growth per crop (Season A, 2019 → 2023):</p>
              <div className="space-y-1.5">
                {cropGrowth.map((c) => (
                  <div key={c.name} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-200 w-24 flex-shrink-0">{c.name}</span>
                    <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${c.growthPct >= 0 ? 'bg-green-500' : 'bg-red-400'}`}
                        style={{ width: `${Math.min(100, Math.abs(c.growthPct))}%` }}
                      />
                    </div>
                    <span className={`text-xs font-semibold w-14 text-right flex-shrink-0 ${c.growthPct >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                      {c.growthPct > 0 ? '+' : ''}{c.growthPct}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          }
          recommendations={[
            'Invest in value-chain development for crops showing high yield growth (processing, packaging).',
            'Introduce improved seed varieties and fertiliser programs in stagnant-yield crops.',
            'Use Insights page to detect which districts drive national yield improvements for replication.',
          ]}
        />

        {/* 5. Export Markets */}
        <SolutionArea
          icon={<Globe className="w-5 h-5 text-white" />}
          color="bg-teal-600"
          title="Export Market Opportunities"
          challenge="Rwanda's high-value crops — Irish Potato, Wheat, and Rice — are produced in concentrated districts, creating natural export supply clusters that lack market linkages to regional and international buyers."
          solution="Agrinsights maps production concentration for export-potential crops, identifying districts that can serve as agricultural export hubs. The data supports making evidence-based cases to attract buyers and investment."
          dataInsight={
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">Top districts by combined export-crop production (Irish Potato + Wheat + Rice, 2023):</p>
              <div className="space-y-1.5">
                {topExportDistricts.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-200 w-24 flex-shrink-0">{d.name}</span>
                    <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-teal-500"
                        style={{ width: `${Math.min(100, (d.production / (topExportDistricts[0]?.production || 1)) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 w-24 text-right flex-shrink-0">
                      {formatNumber(d.production)} t
                    </span>
                  </div>
                ))}
              </div>
            </div>
          }
          recommendations={[
            'Establish agricultural export zones in top-producing northern districts (Irish Potato, Wheat).',
            'Use Agrinsights production data to negotiate supply contracts with regional buyers.',
            'Track season-by-season production volumes to guarantee consistent export supply commitments.',
          ]}
        />

        {/* Data foundation card */}
        <div className="bg-primary-50 dark:bg-primary-900/20 rounded-xl border border-primary-200 dark:border-primary-800 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <BarChart2 className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-base font-bold text-primary-900 dark:text-primary-100">Data Foundation</h3>
          </div>
          <p className="text-sm text-primary-800 dark:text-primary-200 leading-relaxed mb-4">
            All solutions above are grounded in data from the <strong>National Institute of Statistics of Rwanda (NISR)</strong> agricultural surveys, covering:
          </p>
          <ul className="space-y-2">
            {[
              '30 districts across all 5 provinces',
              '8 major food crops with yield, area and production data',
              'Seasons A, B and C (2018–2024)',
              'Yield per hectare trends enabling productivity analysis',
              'Cross-district comparisons for targeting interventions',
            ].map((item) => (
              <li key={item} className="flex gap-2 text-sm text-primary-800 dark:text-primary-200">
                <CheckCircle2 className="w-4 h-4 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
                {item}
              </li>
            ))}
          </ul>
          <p className="text-xs text-primary-600 dark:text-primary-400 mt-4 border-t border-primary-200 dark:border-primary-700 pt-3">
            Data source: NISR PXWeb API — pxweb.statistics.gov.rw · Updated 2024
          </p>
        </div>

      </div>
    </div>
  );
}
