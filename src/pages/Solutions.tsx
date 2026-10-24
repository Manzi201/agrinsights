import { useMemo, useState } from 'react';
import {
  Droplets, Leaf, Package, TrendingUp, Globe,
  AlertTriangle, CheckCircle2, ArrowRight, BarChart2,
  Wrench, Activity, Scale, Star, Navigation, ChevronDown, ChevronUp,
} from 'lucide-react';
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { getAllData, crops, districts } from '../services/agricultureData';
import { getPracticeData, getHarvestData, getLargeScaleData, getCashProdData } from '../services/nisr';
import { formatNumber } from '../utils/calculations';
import { useDataVersion } from '../hooks/useAgricultureData';
import { useTheme } from '../context/ThemeContext';
import type { Season } from '../types/agriculture';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabId = 'irrigation' | 'soil' | 'postharvest' | 'productivity' | 'export' | 'smarttools';
type SmartToolId = 'prediction' | 'supply-gap' | 'opportunity' | 'routing';

interface IrrigationRow { name: string; province: string; irrigatedHa: number; }
interface SoilRow { name: string; province: string; practice: string; coverageHa: number; }
interface CropSummaryRow { name: string; color: string; harvestRatio: number; harvestedHa: number; cultivatedHa: number; }
interface ScaleCompRow { cropName: string; color: string; lsYield: number; ssYield: number; }
interface CashTrendRow { year: number; Coffee: number; Tea: number; }
interface CropGrowthRow { name: string; color: string; yield2019: number; yield2023: number; growthPct: number; }
interface ExportDistrictRow { name: string; province: string; production: number; }

interface SupplyGapRow {
  districtId: string;
  districtName: string;
  province: string;
  production: number;
  demand: number;
  surplus: number;
  isSurplus: boolean;
  neighbors: { name: string; distanceKm: number }[];
}

interface OpportunityCard {
  districtName: string;
  cropName: string;
  cropColor: string;
  tag: 'Improvement Opportunity' | 'Investment Opportunity' | 'Risk Alert' | 'Intensification Opportunity';
  tagColor: string;
  detail: string;
}

interface RoutingHub { districtId: string; districtName: string; province: string; production: number; }
interface RoutingRow { lowDistrict: string; nearestHub: string; distanceKm: number; productionGap: number; }

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Population proxy: district base area (ha) * 0.3 people per ha ~ rough proxy
const DISTRICT_POP: Record<string, number> = {
  gasabo: 9000, kicukiro: 4500, nyarugenge: 4000,
  bugesera: 33000, gatsibo: 38000, kayonza: 27000, kirehe: 28000,
  ngoma: 22000, nyagatare: 55000, rwamagana: 25000,
  burera: 18000, gakenke: 20000, gicumbi: 28000, musanze: 16000, rulindo: 18000,
  gisagara: 22000, huye: 25000, kamonyi: 20000, muhanga: 18000,
  nyamagabe: 24000, nyanza: 18000, nyaruguru: 18000, ruhango: 18000,
  karongi: 24000, ngororero: 22000, nyabihu: 18000, nyamasheke: 26000,
  rubavu: 15000, rusizi: 28000, rutsiro: 20000,
};

// ---------------------------------------------------------------------------
// Haversine distance (km)
// ---------------------------------------------------------------------------

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// ---------------------------------------------------------------------------
// Data computation functions (plain, not hooks — safe inside useMemo)
// ---------------------------------------------------------------------------

function computeIrrigationData(): IrrigationRow[] {
  const pd = getPracticeData();
  if (pd.length === 0) return [];

  // Sum 'Modern irrigated land' ha per district across all seasons
  const irrigMap = new Map<string, number>();
  for (const p of pd.filter((x) => x.practice === 'Modern irrigated land')) {
    irrigMap.set(p.districtId, (irrigMap.get(p.districtId) ?? 0) + p.areaHa);
  }

  return districts
    .filter((d) => (irrigMap.get(d.id) ?? 0) > 0)
    .map((d) => ({
      name: d.name,
      province: d.province,
      irrigatedHa: Math.round(irrigMap.get(d.id) ?? 0),
    }))
    .sort((a, b) => b.irrigatedHa - a.irrigatedHa)
    .slice(0, 10);
}

function computeSoilData(): SoilRow[] {
  const pd = getPracticeData();
  if (pd.length === 0) return [];

  // Show erosion control and inorganic fertilizer coverage per district
  const targetPractices = ['Erosion control', 'Inorganic fertilizer'];
  const practiceMap = new Map<string, { name: string; province: string; ha: number }>();

  for (const p of pd.filter((x) => targetPractices.includes(x.practice))) {
    const d = districts.find((di) => di.id === p.districtId);
    if (!d) continue;
    const key = `${p.districtId}::${p.practice}`;
    if (!practiceMap.has(key)) practiceMap.set(key, { name: d.name, province: d.province, ha: 0 });
    practiceMap.get(key)!.ha += p.areaHa;
  }

  // Aggregate by district: sum all practice ha
  const districtMap = new Map<string, SoilRow>();
  for (const [key, val] of practiceMap) {
    const [distId] = key.split('::');
    const practice = key.split('::')[1];
    if (!districtMap.has(distId)) {
      districtMap.set(distId, { name: val.name, province: val.province, practice: '', coverageHa: 0 });
    }
    const row = districtMap.get(distId)!;
    row.coverageHa += Math.round(val.ha);
    row.practice = row.practice ? row.practice + ' + ' + practice : practice;
  }

  return Array.from(districtMap.values())
    .sort((a, b) => a.coverageHa - b.coverageHa) // lowest coverage first (most at risk)
    .slice(0, 10);
}

function computePostHarvestData(): CropSummaryRow[] {
  const hd = getHarvestData();
  if (hd.length === 0) return [];

  // Average harvest ratio per crop across all districts/seasons
  const ratioMap = new Map<string, { harvestedHa: number; cultivatedHa: number; count: number }>();
  for (const p of hd) {
    if (!ratioMap.has(p.cropId)) ratioMap.set(p.cropId, { harvestedHa: 0, cultivatedHa: 0, count: 0 });
    const r = ratioMap.get(p.cropId)!;
    r.harvestedHa += p.harvestedHa;
    r.cultivatedHa += p.cultivatedHa;
    r.count++;
  }

  return crops
    .filter((c) => ratioMap.has(c.id))
    .map((c) => {
      const r = ratioMap.get(c.id)!;
      const harvestRatio = r.cultivatedHa > 0 ? Math.min(100, Math.round((r.harvestedHa / r.cultivatedHa) * 1000) / 10) : 0;
      return {
        name: c.name,
        color: c.color,
        harvestRatio,
        harvestedHa: Math.round(r.harvestedHa / Math.max(1, r.count)),
        cultivatedHa: Math.round(r.cultivatedHa / Math.max(1, r.count)),
      };
    })
    .filter((c) => c.cultivatedHa > 0)
    .sort((a, b) => a.harvestRatio - b.harvestRatio); // lowest ratio first (most at risk)
}

function computeProductivityData(): CropGrowthRow[] {
  const data = getAllData();
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

  return crops
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
}

function computeScaleComparison(): ScaleCompRow[] {
  const lsd = getLargeScaleData();
  if (lsd.length === 0) return [];

  const data = getAllData();
  const adYears = data.filter((p) => p.season === 'A').map((p) => p.year);
  const latestYear = adYears.length > 0 ? Math.max(...adYears) : 2023;

  // Large-scale yield avg per crop (Season A)
  const lsMap = new Map<string, number[]>();
  for (const p of lsd.filter((x) => x.season === 'A')) {
    if (!lsMap.has(p.cropId)) lsMap.set(p.cropId, []);
    lsMap.get(p.cropId)!.push(p.yieldKgPerHa);
  }

  // Small-scale yield avg per crop (Season A, latest year) — getAllData yields are in t/ha, convert to kg
  const ssMap = new Map<string, number[]>();
  for (const p of data.filter((x) => x.season === 'A' && x.year === latestYear)) {
    if (!ssMap.has(p.cropId)) ssMap.set(p.cropId, []);
    ssMap.get(p.cropId)!.push(p.yieldPerHa * 1000);
  }

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

  return crops
    .filter((c) => lsMap.has(c.id) && ssMap.has(c.id))
    .map((c) => ({
      cropName: c.name,
      color: c.color,
      lsYield: Math.round(avg(lsMap.get(c.id)!)),
      ssYield: Math.round(avg(ssMap.get(c.id)!)),
    }))
    .filter((r) => r.ssYield > 0)
    .sort((a, b) => (b.lsYield - b.ssYield) - (a.lsYield - a.ssYield));
}

function computeCashProdTrend(): CashTrendRow[] {
  const cpd = getCashProdData();
  if (cpd.length === 0) return [];

  const byYear = new Map<number, { Coffee: number; Tea: number }>();
  for (const p of cpd) {
    if (!byYear.has(p.year)) byYear.set(p.year, { Coffee: 0, Tea: 0 });
    byYear.get(p.year)![p.crop] = p.productionTons;
  }

  return Array.from(byYear.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([year, vals]) => ({ year, Coffee: vals.Coffee, Tea: vals.Tea }));
}

function computeExportData(): ExportDistrictRow[] {
  const data = getAllData();
  const exportCrops = ['irish-potato', 'wheat', 'rice'];
  const exportByDistrict = new Map<string, number>();

  for (const dp of data.filter((dp) => dp.year === 2023 && dp.season === 'A' && exportCrops.includes(dp.cropId))) {
    exportByDistrict.set(dp.districtId, (exportByDistrict.get(dp.districtId) ?? 0) + dp.production);
  }

  return districts
    .filter((d) => exportByDistrict.has(d.id))
    .map((d) => ({
      name: d.name,
      province: d.province,
      production: Math.round(exportByDistrict.get(d.id) ?? 0),
    }))
    .sort((a, b) => b.production - a.production)
    .slice(0, 10);
}

// ---------------------------------------------------------------------------
// Recharts chart style helper
// ---------------------------------------------------------------------------

function useChartStyle() {
  const { isDark } = useTheme();
  return {
    isDark,
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
}

// ---------------------------------------------------------------------------
// SolutionArea card (kept for compatibility)
// ---------------------------------------------------------------------------

interface SolutionAreaProps {
  icon: React.ReactNode;
  color: string;
  title: string;
  challenge: string;
  solution: string;
  dataInsight: React.ReactNode;
  recommendations: string[];
  chart?: React.ReactNode;
}

function SolutionArea({ icon, color, title, challenge, solution, dataInsight, recommendations, chart }: SolutionAreaProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className={`px-5 py-4 ${color} flex items-center gap-3`}>
        <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
        <h3 className="text-base font-bold text-white">{title}</h3>
      </div>

      <div className="p-5 space-y-4">
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">Challenge</span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{challenge}</p>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-1.5 mb-2">
            <BarChart2 className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400 flex-shrink-0" />
            <span className="text-xs font-semibold text-primary-700 dark:text-primary-400 uppercase tracking-wide">NISR Data Evidence</span>
          </div>
          {dataInsight}
        </div>

        {chart && (
          <div className="rounded-lg overflow-hidden" style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              {chart as React.ReactElement}
            </ResponsiveContainer>
          </div>
        )}

        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
            <span className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide">How Agrinsights Helps</span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{solution}</p>
        </div>

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
// Tab 1 — Irrigation
// ---------------------------------------------------------------------------

function IrrigationTab({ irrigationData }: { irrigationData: IrrigationRow[] }) {
  const cs = useChartStyle();
  const chartData = irrigationData.map((d) => ({
    name: d.name,
    'Irrigated (ha)': d.irrigatedHa,
  }));

  return (
    <div className="space-y-6">
      <SolutionArea
        icon={<Droplets className="w-5 h-5 text-white" />}
        color="bg-blue-600"
        title="Small-Scale Irrigation"
        challenge="Many districts have little to no modern irrigation infrastructure, leaving crops entirely dependent on rainfall. This drives large season-to-season yield variability and food insecurity."
        solution="Agrinsights maps modern irrigated land coverage per district using NISR practice data, pinpointing exactly where irrigation investment would have the highest impact."
        dataInsight={
          irrigationData.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">Data loading...</p>
          ) : (
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">Top districts by modern irrigated land area (ha):</p>
              <div className="space-y-1.5">
                {irrigationData.slice(0, 5).map((d) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-200 w-24 flex-shrink-0">{d.name}</span>
                    <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-blue-500"
                        style={{ width: `${Math.min(100, (d.irrigatedHa / (irrigationData[0]?.irrigatedHa || 1)) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 w-24 text-right flex-shrink-0">
                      {formatNumber(d.irrigatedHa)} ha
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        }
        recommendations={[
          'Prioritize irrigation investment in districts with zero or minimal modern irrigated land.',
          'Use Agrinsights district map to identify marshland areas suitable for small dam construction.',
          'Track irrigation program impact year-over-year via the Crop Comparison tool.',
        ]}
        chart={chartData.length > 0 ? (
          <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 60, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={cs.grid} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: cs.axis }} stroke={cs.axis} angle={-35} textAnchor="end" interval={0} />
            <YAxis tick={{ fontSize: 11, fill: cs.axis }} stroke={cs.axis} tickFormatter={(v) => `${v.toLocaleString()}`} />
            <Tooltip contentStyle={cs.tt} formatter={(v) => [formatNumber(v as number) + ' ha', '']} />
            <Legend wrapperStyle={{ fontSize: 12, color: cs.isDark ? '#9ca3af' : undefined }} />
            <Bar dataKey="Irrigated (ha)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        ) : undefined}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 2 — Soil & Fertility
// ---------------------------------------------------------------------------

function SoilTab({ soilDistricts }: { soilDistricts: SoilRow[] }) {
  const cs = useChartStyle();
  const chartData = soilDistricts.map((d) => ({
    name: d.name,
    'Conservation (ha)': d.coverageHa,
  }));

  return (
    <div className="space-y-6">
      <SolutionArea
        icon={<Leaf className="w-5 h-5 text-white" />}
        color="bg-amber-600"
        title="Soil Conservation & Fertility Management"
        challenge="Districts with low adoption of erosion control and fertilizer practices face declining soil health over time, reducing yield potential despite available land."
        solution="Agrinsights tracks erosion control and inorganic fertilizer practice coverage per district from NISR data. Districts with the lowest combined coverage are flagged as soil conservation priority areas."
        dataInsight={
          soilDistricts.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">Data loading...</p>
          ) : (
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">Districts with lowest soil conservation practice coverage (ha):</p>
              <div className="space-y-1.5">
                {soilDistricts.slice(0, 5).map((d) => (
                  <div key={d.name} className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-200 w-24 flex-shrink-0">{d.name}</span>
                    <div className="flex-1 text-center">
                      <span className="text-xs text-gray-500 dark:text-gray-400">{d.practice}</span>
                    </div>
                    <span className="text-xs font-semibold w-20 text-right flex-shrink-0 text-amber-700 dark:text-amber-400">
                      {formatNumber(d.coverageHa)} ha
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        }
        recommendations={[
          'Target districts with lowest erosion control coverage for soil health assessments and terracing programs.',
          'Use Agrinsights yield heatmap to guide fertiliser subsidy allocation to low-coverage districts.',
          'Promote agroforestry and crop rotation policies in districts with zero organic fertilizer practice.',
        ]}
        chart={chartData.length > 0 ? (
          <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 60, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={cs.grid} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: cs.axis }} stroke={cs.axis} angle={-35} textAnchor="end" interval={0} />
            <YAxis tick={{ fontSize: 11, fill: cs.axis }} stroke={cs.axis} tickFormatter={(v) => `${v.toLocaleString()}`} />
            <Tooltip contentStyle={cs.tt} formatter={(v) => [formatNumber(v as number) + ' ha', '']} />
            <Legend wrapperStyle={{ fontSize: 12, color: cs.isDark ? '#9ca3af' : undefined }} />
            <Bar dataKey="Conservation (ha)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          </BarChart>
        ) : undefined}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 3 — Post-Harvest
// ---------------------------------------------------------------------------

function PostHarvestTab({ cropSummary }: { cropSummary: CropSummaryRow[] }) {
  const cs = useChartStyle();
  const chartData = cropSummary.map((c) => ({
    name: c.name,
    'Harvest Ratio (%)': c.harvestRatio,
    fill: c.color,
  }));

  return (
    <div className="space-y-6">
      <SolutionArea
        icon={<Package className="w-5 h-5 text-white" />}
        color="bg-orange-600"
        title="Post-Harvest Collection & Storage"
        challenge="When the harvested area is significantly lower than the cultivated area, crops are being left in the field — indicating post-harvest losses from lack of storage, labour, or collection infrastructure."
        solution="Agrinsights uses NISR harvest ratio data (harvested ÷ cultivated area) per crop to identify which crops have the worst post-harvest losses nationally, guiding investment in cooperative storage and collection logistics."
        dataInsight={
          cropSummary.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">Data loading...</p>
          ) : (
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">Crops by average harvest ratio (lowest = highest post-harvest loss risk):</p>
              <div className="space-y-1.5">
                {cropSummary.slice(0, 5).map((c) => (
                  <div key={c.name} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-200 w-24 flex-shrink-0">{c.name}</span>
                    <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                      <div
                        className="h-2 rounded-full"
                        style={{ backgroundColor: c.color, width: `${Math.min(100, c.harvestRatio)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 w-16 text-right flex-shrink-0">
                      {c.harvestRatio}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        }
        recommendations={[
          'Build or expand storage facilities for crops with harvest ratios below 80%.',
          'Develop cooperative buying programs to ensure timely collection at harvest.',
          'Use Reports page to generate district-level harvest ratio forecasts for storage planning.',
        ]}
        chart={chartData.length > 0 ? (
          <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 40, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={cs.grid} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: cs.axis }} stroke={cs.axis} angle={-25} textAnchor="end" interval={0} />
            <YAxis tick={{ fontSize: 11, fill: cs.axis }} stroke={cs.axis} tickFormatter={(v) => `${v}%`} domain={[0, 110]} />
            <Tooltip contentStyle={cs.tt} formatter={(v) => [(v as number).toFixed(1) + '%', 'Harvest Ratio']} />
            <Bar dataKey="Harvest Ratio (%)" radius={[4, 4, 0, 0]}>
              {chartData.map((_entry, index) => (
                <Cell key={`cell-${index}`} fill={cropSummary[index]?.color ?? '#6366f1'} />
              ))}
            </Bar>
          </BarChart>
        ) : undefined}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 4 — Productivity
// ---------------------------------------------------------------------------

function ProductivityTab({ cropGrowth, scaleComparison }: { cropGrowth: CropGrowthRow[]; scaleComparison: ScaleCompRow[] }) {
  const cs = useChartStyle();
  const chartData = cropGrowth.map((c) => ({
    name: c.name,
    '2019': c.yield2019,
    '2023': c.yield2023,
  }));
  const scaleChartData = scaleComparison.map((c) => ({
    name: c.cropName,
    'Large-Scale (kg/ha)': c.lsYield,
    'Small-Scale (kg/ha)': c.ssYield,
  }));

  return (
    <div className="space-y-6">
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
        chart={
          <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 40, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={cs.grid} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: cs.axis }} stroke={cs.axis} angle={-25} textAnchor="end" interval={0} />
            <YAxis tick={{ fontSize: 11, fill: cs.axis }} stroke={cs.axis} tickFormatter={(v) => `${v} t/ha`} />
            <Tooltip contentStyle={cs.tt} formatter={(v) => [(v as number).toFixed(2) + ' t/ha', '']} />
            <Legend wrapperStyle={{ fontSize: 12, color: cs.isDark ? '#9ca3af' : undefined }} />
            <Bar dataKey="2019" fill="#a855f7" radius={[4, 4, 0, 0]} />
            <Bar dataKey="2023" fill="#7c3aed" radius={[4, 4, 0, 0]} />
          </BarChart>
        }
      />

      {/* Large-scale vs small-scale yield comparison */}
      {scaleComparison.length > 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">Large-Scale vs Small-Scale Farmer Yield</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Intensification opportunity: where large-scale yield significantly exceeds small-scale yield, technology transfer can close the gap.</p>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scaleChartData} margin={{ top: 5, right: 20, bottom: 50, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={cs.grid} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: cs.axis }} stroke={cs.axis} angle={-30} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 11, fill: cs.axis }} stroke={cs.axis} tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`} />
                <Tooltip contentStyle={cs.tt} formatter={(v) => [formatNumber(v as number) + ' kg/ha', '']} />
                <Legend wrapperStyle={{ fontSize: 12, color: cs.isDark ? '#9ca3af' : undefined }} />
                <Bar dataKey="Large-Scale (kg/ha)" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Small-Scale (kg/ha)" fill="#c4b5fd" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-400 dark:text-gray-500 italic">Large-scale yield data loading...</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 5 — Export Markets
// ---------------------------------------------------------------------------

function ExportMarketsTab({ topExportDistricts, cashTrend }: { topExportDistricts: ExportDistrictRow[]; cashTrend: CashTrendRow[] }) {
  const cs = useChartStyle();
  const chartData = topExportDistricts.map((d) => ({
    name: d.name,
    Production: d.production,
  }));

  return (
    <div className="space-y-6">
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
              {topExportDistricts.slice(0, 5).map((d, i) => (
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
        chart={
          <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 60, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={cs.grid} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: cs.axis }} stroke={cs.axis} angle={-35} textAnchor="end" interval={0} />
            <YAxis tick={{ fontSize: 11, fill: cs.axis }} stroke={cs.axis} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip contentStyle={cs.tt} formatter={(v) => [formatNumber(v as number) + ' t', 'Production']} />
            <Bar dataKey="Production" fill="#14b8a6" radius={[4, 4, 0, 0]} />
          </BarChart>
        }
      />

      {/* Coffee & Tea production trend */}
      {cashTrend.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">Coffee & Tea Production Trend</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Rwanda's two main cash export crops — yearly production in tonnes (NISR cash crop data).</p>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashTrend} margin={{ top: 5, right: 20, bottom: 20, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={cs.grid} />
                <XAxis dataKey="year" tick={{ fontSize: 10, fill: cs.axis }} stroke={cs.axis} />
                <YAxis tick={{ fontSize: 11, fill: cs.axis }} stroke={cs.axis} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={cs.tt} formatter={(v) => [formatNumber(v as number) + ' t', '']} />
                <Legend wrapperStyle={{ fontSize: 12, color: cs.isDark ? '#9ca3af' : undefined }} />
                <Bar dataKey="Coffee" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Tea" fill="#14b8a6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Smart Tool A — Prediction Simulator
// ---------------------------------------------------------------------------

function computePredictionData(
  districtId: string,
  cropId: string,
  season: Season,
  yieldImprovePct: number,
  areaExpandPct: number,
) {
  const data = getAllData();
  const filtered = data.filter(
    (dp) =>
      dp.districtId === districtId &&
      dp.cropId === cropId &&
      dp.season === season &&
      (dp.year === 2024 || dp.year === 2023),
  );

  // Prefer 2024, fallback to 2023
  const year2024 = filtered.filter((dp) => dp.year === 2024);
  const rows = year2024.length > 0 ? year2024 : filtered.filter((dp) => dp.year === 2023);

  if (rows.length === 0) {
    return {
      currentProduction: 0,
      currentArea: 0,
      currentYield: 0,
      projectedProduction: 0,
      projectedArea: 0,
      projectedYield: 0,
    };
  }

  const currentProduction = rows.reduce((s, dp) => s + dp.production, 0);
  const currentArea = rows.reduce((s, dp) => s + dp.area, 0);
  const currentYield = currentArea > 0 ? currentProduction / currentArea : 0;
  const projectedArea = currentArea * (1 + areaExpandPct / 100);
  const projectedYield = currentYield * (1 + yieldImprovePct / 100);
  const projectedProduction = projectedArea * projectedYield;

  return {
    currentProduction,
    currentArea,
    currentYield,
    projectedProduction: Math.round(projectedProduction),
    projectedArea: Math.round(projectedArea),
    projectedYield,
  };
}

function PredictionSimulator() {
  const [selectedDistrict, setSelectedDistrict] = useState('musanze');
  const [selectedCrop, setSelectedCrop] = useState('irish-potato');
  const [selectedSeason, setSelectedSeason] = useState<Season>('A');
  const [yieldImprove, setYieldImprove] = useState(20);
  const [areaExpand, setAreaExpand] = useState(10);
  const cs = useChartStyle();

  const result = useMemo(
    () => computePredictionData(selectedDistrict, selectedCrop, selectedSeason, yieldImprove, areaExpand),
    [selectedDistrict, selectedCrop, selectedSeason, yieldImprove, areaExpand],
  );

  const delta = result.projectedProduction - result.currentProduction;
  const deltaPct = result.currentProduction > 0 ? (delta / result.currentProduction) * 100 : 0;

  // Only Production and Area on the grouped bar chart.
  // Yield is shown as a separate stat card to avoid confusing axis-collapse encodings.
  const chartData = [
    { metric: 'Production (t)', Current: Math.round(result.currentProduction), Projected: Math.round(result.projectedProduction) },
    { metric: 'Area (ha)', Current: Math.round(result.currentArea), Projected: Math.round(result.projectedArea) },
  ];

  const selectClass = 'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Controls */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Configure Scenario</h4>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">District</label>
            <select className={selectClass} value={selectedDistrict} onChange={(e) => setSelectedDistrict(e.target.value)}>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Crop</label>
            <select className={selectClass} value={selectedCrop} onChange={(e) => setSelectedCrop(e.target.value)}>
              {crops.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Season</label>
            <select className={selectClass} value={selectedSeason} onChange={(e) => setSelectedSeason(e.target.value as Season)}>
              <option value="A">Season A</option>
              <option value="B">Season B</option>
              <option value="C">Season C</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Yield Improvement: <span className="font-bold text-primary-600 dark:text-primary-400">{yieldImprove}%</span>
            </label>
            <input
              type="range" min={0} max={100} value={yieldImprove}
              onChange={(e) => setYieldImprove(Number(e.target.value))}
              className="w-full accent-primary-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Area Expansion: <span className="font-bold text-primary-600 dark:text-primary-400">{areaExpand}%</span>
            </label>
            <input
              type="range" min={0} max={50} value={areaExpand}
              onChange={(e) => setAreaExpand(Number(e.target.value))}
              className="w-full accent-primary-600"
            />
          </div>
        </div>

        {/* Results */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Projected Outcome</h4>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Current Production</p>
              <p className="text-lg font-bold text-gray-800 dark:text-gray-100">{formatNumber(result.currentProduction)} t</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{formatNumber(result.currentArea)} ha</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Projected Production</p>
              <p className="text-lg font-bold text-green-700 dark:text-green-400">{formatNumber(result.projectedProduction)} t</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{formatNumber(result.projectedArea)} ha</p>
            </div>
          </div>

          <div className={`rounded-lg p-3 border text-center ${delta >= 0 ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>
            <span className={`text-sm font-bold ${delta >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
              {delta >= 0 ? '+' : ''}{formatNumber(delta)} t ({deltaPct >= 0 ? '+' : ''}{deltaPct.toFixed(1)}%)
            </span>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">projected change</p>
          </div>

          {/* Yield stat card — shown separately to avoid axis-collapse encoding on the chart */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Current Yield</p>
              <p className="text-base font-bold text-gray-800 dark:text-gray-100">{result.currentYield.toFixed(2)} t/ha</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Projected Yield</p>
              <p className="text-base font-bold text-blue-700 dark:text-blue-400">{result.projectedYield.toFixed(2)} t/ha</p>
            </div>
          </div>

          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 30, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={cs.grid} />
                <XAxis dataKey="metric" tick={{ fontSize: 10, fill: cs.axis }} stroke={cs.axis} />
                <YAxis tick={{ fontSize: 10, fill: cs.axis }} stroke={cs.axis} />
                <Tooltip
                  contentStyle={cs.tt}
                  formatter={(v, name) => [formatNumber(v as number), name as string]}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: cs.isDark ? '#9ca3af' : undefined }} />
                <Bar dataKey="Current" fill="#6b7280" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Projected" fill="#16a34a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Smart Tool B — Supply Gap Finder
// ---------------------------------------------------------------------------

function computeSupplyGapData(cropId: string): SupplyGapRow[] {
  const data = getAllData();
  const filtered = data.filter((dp) => dp.cropId === cropId && dp.year === 2023);
  const prodByDistrict = new Map<string, number>();
  for (const dp of filtered) {
    prodByDistrict.set(dp.districtId, (prodByDistrict.get(dp.districtId) ?? 0) + dp.production);
  }

  const rows: SupplyGapRow[] = districts.map((d) => {
    const production = Math.round(prodByDistrict.get(d.id) ?? 0);
    const popProxy = (DISTRICT_POP[d.id] ?? 15000) * 0.3;
    const demand = Math.round(popProxy * 0.1);
    const surplus = production - demand;
    return {
      districtId: d.id,
      districtName: d.name,
      province: d.province,
      production,
      demand,
      surplus,
      isSurplus: surplus >= 0,
      neighbors: [],
    };
  });

  // Find nearest 2 surplus districts for each deficit
  const surplusRows = rows.filter((r) => r.isSurplus);
  for (const row of rows) {
    if (!row.isSurplus) {
      const defDist = districts.find((d) => d.id === row.districtId)!;
      const sorted = surplusRows
        .map((sr) => {
          const sd = districts.find((d) => d.id === sr.districtId)!;
          return { name: sr.districtName, distanceKm: haversineKm(defDist.lat, defDist.lng, sd.lat, sd.lng) };
        })
        .sort((a, b) => a.distanceKm - b.distanceKm);
      row.neighbors = sorted.slice(0, 2);
    }
  }

  return rows.sort((a, b) => a.surplus - b.surplus);
}

function SupplyGapFinder() {
  const [selectedCrop, setSelectedCrop] = useState('maize');
  const rows = useMemo(() => computeSupplyGapData(selectedCrop), [selectedCrop]);
  const surplusCount = rows.filter((r) => r.isSurplus).length;
  const deficitCount = rows.length - surplusCount;

  const selectClass = 'rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Crop</label>
          <select className={selectClass} value={selectedCrop} onChange={(e) => setSelectedCrop(e.target.value)}>
            {crops.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex gap-3 mt-4">
          <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs font-semibold rounded-full">{surplusCount} Surplus Districts</span>
          <span className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 text-xs font-semibold rounded-full">{deficitCount} Deficit Districts</span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700 text-left">
              <th className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-300">District</th>
              <th className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-300">Province</th>
              <th className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-300 text-right">Production (t)</th>
              <th className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-300 text-right">Est. Need (t)</th>
              <th className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-300 text-right">Surplus/Deficit</th>
              <th className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-300">Status</th>
              <th className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-300">Nearest Surplus</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {rows.map((row) => (
              <tr
                key={row.districtId}
                className={row.isSurplus
                  ? 'bg-green-50 dark:bg-green-900/10'
                  : 'bg-red-50 dark:bg-red-900/10'}
              >
                <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-200">{row.districtName}</td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{row.province}</td>
                <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{formatNumber(row.production)}</td>
                <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{formatNumber(row.demand)}</td>
                <td className={`px-3 py-2 text-right font-semibold ${row.isSurplus ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                  {row.surplus >= 0 ? '+' : ''}{formatNumber(row.surplus)}
                </td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${row.isSurplus ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300'}`}>
                    {row.isSurplus ? 'Surplus' : 'Deficit'}
                  </span>
                </td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                  {!row.isSurplus && row.neighbors.map((n, i) => (
                    <span key={i} className="block">{n.name} ({n.distanceKm} km)</span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Smart Tool C — Opportunity Finder
// ---------------------------------------------------------------------------

function computeOpportunityData(): OpportunityCard[] {
  const data = getAllData();
  const cards: OpportunityCard[] = [];

  // Season A 2023 data
  const a2023 = data.filter((dp) => dp.season === 'A' && dp.year === 2023);

  // National avg yield per crop
  const nationalYield = new Map<string, number[]>();
  for (const dp of a2023) {
    if (!nationalYield.has(dp.cropId)) nationalYield.set(dp.cropId, []);
    nationalYield.get(dp.cropId)!.push(dp.yieldPerHa);
  }
  const avgYield = new Map<string, number>();
  for (const [cropId, vals] of nationalYield) {
    avgYield.set(cropId, vals.reduce((a, b) => a + b, 0) / vals.length);
  }

  // National total production per crop 2022 vs 2023 season A
  const a2022 = data.filter((dp) => dp.season === 'A' && dp.year === 2022);
  const prod2022 = new Map<string, number>();
  const prod2023 = new Map<string, number>();
  for (const dp of a2022) prod2022.set(dp.cropId, (prod2022.get(dp.cropId) ?? 0) + dp.production);
  for (const dp of a2023) prod2023.set(dp.cropId, (prod2023.get(dp.cropId) ?? 0) + dp.production);

  // Risk alert crops
  const riskCrops = new Set<string>();
  for (const c of crops) {
    const p22 = prod2022.get(c.id) ?? 0;
    const p23 = prod2023.get(c.id) ?? 0;
    if (p22 > 0 && (p22 - p23) / p22 > 0.05) riskCrops.add(c.id);
  }

  // Area distribution for intensification
  const areaArr = new Map<string, number[]>();
  for (const dp of a2023) {
    if (!areaArr.has(dp.cropId)) areaArr.set(dp.cropId, []);
    areaArr.get(dp.cropId)!.push(dp.area);
  }
  const medianArea = new Map<string, number>();
  for (const [cropId, arr] of areaArr) {
    const sorted = [...arr].sort((a, b) => a - b);
    medianArea.set(cropId, sorted[Math.floor(sorted.length / 2)]);
  }

  // Per-district, per-crop data for 2023 A
  const districtCropMap = new Map<string, Map<string, { yieldPerHa: number; area: number }>>();
  for (const dp of a2023) {
    if (!districtCropMap.has(dp.districtId)) districtCropMap.set(dp.districtId, new Map());
    districtCropMap.get(dp.districtId)!.set(dp.cropId, { yieldPerHa: dp.yieldPerHa, area: dp.area });
  }

  // Risk alert: 1 card per crop (avoid flooding)
  for (const cropId of riskCrops) {
    const crop = crops.find((c) => c.id === cropId);
    if (!crop) continue;
    const p22 = prod2022.get(cropId) ?? 0;
    const p23 = prod2023.get(cropId) ?? 0;
    const drop = p22 > 0 ? ((p22 - p23) / p22 * 100).toFixed(1) : '0';
    cards.push({
      districtName: 'All Districts',
      cropName: crop.name,
      cropColor: crop.color,
      tag: 'Risk Alert',
      tagColor: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
      detail: `National production dropped ${drop}% (2022→2023)`,
    });
  }

  // Per-district analysis
  for (const district of districts) {
    const dcMap = districtCropMap.get(district.id);
    if (!dcMap) continue;

    for (const crop of crops) {
      const dcData = dcMap.get(crop.id);
      if (!dcData) continue;

      const natAvg = avgYield.get(crop.id) ?? 0;
      const medArea = medianArea.get(crop.id) ?? 0;

      // Improvement Opportunity
      if (natAvg > 0 && dcData.yieldPerHa < natAvg * 0.70) {
        cards.push({
          districtName: district.name,
          cropName: crop.name,
          cropColor: crop.color,
          tag: 'Improvement Opportunity',
          tagColor: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
          detail: `Yield: ${dcData.yieldPerHa.toFixed(2)} t/ha vs avg ${natAvg.toFixed(2)} t/ha`,
        });
      }

      // Intensification Opportunity
      if (dcData.area > medArea && natAvg > 0 && dcData.yieldPerHa < natAvg) {
        cards.push({
          districtName: district.name,
          cropName: crop.name,
          cropColor: crop.color,
          tag: 'Intensification Opportunity',
          tagColor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
          detail: `Large area (${formatNumber(dcData.area)} ha) but below-avg yield`,
        });
      }
    }
  }

  // Investment Opportunity: consecutive growth (season A, 2021-2022-2023)
  const yearlyProd = new Map<string, Map<string, number>>(); // districtId -> cropId -> year -> prod
  const years = [2021, 2022, 2023];
  for (const year of years) {
    const aYear = data.filter((dp) => dp.season === 'A' && dp.year === year);
    for (const dp of aYear) {
      const key = `${dp.districtId}::${dp.cropId}`;
      if (!yearlyProd.has(key)) yearlyProd.set(key, new Map());
      yearlyProd.get(key)!.set(String(year), dp.production);
    }
  }

  for (const district of districts) {
    for (const crop of crops) {
      const key = `${district.id}::${crop.id}`;
      const yp = yearlyProd.get(key);
      if (!yp) continue;
      const p21 = yp.get('2021') ?? 0;
      const p22 = yp.get('2022') ?? 0;
      const p23 = yp.get('2023') ?? 0;
      if (p21 > 0 && p22 > p21 && p23 > p22) {
        cards.push({
          districtName: district.name,
          cropName: crop.name,
          cropColor: crop.color,
          tag: 'Investment Opportunity',
          tagColor: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
          detail: `3 consecutive years of growth (${formatNumber(p21)}→${formatNumber(p22)}→${formatNumber(p23)} t)`,
        });
      }
    }
  }

  // Cap at 80 cards
  return cards.slice(0, 80);
}

type OpportunityFilter = 'all' | OpportunityCard['tag'];

function OpportunityFinder() {
  const [filterTag, setFilterTag] = useState<OpportunityFilter>('all');
  const cards = useMemo(() => computeOpportunityData(), []);

  const filterOptions: { label: string; value: OpportunityFilter }[] = [
    { label: 'All', value: 'all' },
    { label: 'Risk Alert', value: 'Risk Alert' },
    { label: 'Improvement', value: 'Improvement Opportunity' },
    { label: 'Intensification', value: 'Intensification Opportunity' },
    { label: 'Investment', value: 'Investment Opportunity' },
  ];

  // Precompute counts once per cards change to avoid inline filter on every render
  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = { all: cards.length };
    for (const card of cards) {
      counts[card.tag] = (counts[card.tag] ?? 0) + 1;
    }
    return counts;
  }, [cards]);

  const filtered = filterTag === 'all' ? cards : cards.filter((c) => c.tag === filterTag);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {filterOptions.map((fo) => (
          <button
            key={fo.value}
            onClick={() => setFilterTag(fo.value)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
              filterTag === fo.value
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {fo.label} ({tagCounts[fo.value] ?? 0})
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map((card, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{card.districtName}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: card.cropColor }} />
                  <span className="text-xs text-gray-500 dark:text-gray-400">{card.cropName}</span>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${card.tagColor}`}>
                {card.tag === 'Improvement Opportunity' ? 'Improvement' :
                 card.tag === 'Investment Opportunity' ? 'Investment' :
                 card.tag === 'Intensification Opportunity' ? 'Intensification' : 'Risk Alert'}
              </span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400">{card.detail}</p>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">No opportunities found for the selected filter.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Smart Tool D — Regional Supply Routing
// ---------------------------------------------------------------------------

function computeRoutingData(cropId: string): { hubs: RoutingHub[]; needsSupply: RoutingRow[] } {
  const data = getAllData();
  const filtered = data.filter((dp) => dp.cropId === cropId && dp.season === 'A' && dp.year === 2023);
  const prodByDistrict = new Map<string, number>();
  for (const dp of filtered) {
    prodByDistrict.set(dp.districtId, (prodByDistrict.get(dp.districtId) ?? 0) + dp.production);
  }

  // Only include districts that actually grow the crop (production > 0)
  const sorted = districts
    .map((d) => ({ district: d, production: prodByDistrict.get(d.id) ?? 0 }))
    .filter((item) => item.production > 0)
    .sort((a, b) => b.production - a.production);

  const top5 = sorted.slice(0, 5);
  // Bottom 5: lowest-producing districts that DO grow the crop (sorted already filters production > 0)
  const validDistricts = sorted.length;
  const bottom5Start = Math.max(5, validDistricts - 5);
  const bottom5 = sorted.slice(bottom5Start);

  const hubs: RoutingHub[] = top5.map((item) => ({
    districtId: item.district.id,
    districtName: item.district.name,
    province: item.district.province,
    production: Math.round(item.production),
  }));

  const needsSupply: RoutingRow[] = bottom5.map((item) => {
    const nearestHub = top5
      .map((h) => ({
        name: h.district.name,
        distanceKm: haversineKm(item.district.lat, item.district.lng, h.district.lat, h.district.lng),
        production: h.production,
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm)[0];

    return {
      lowDistrict: item.district.name,
      nearestHub: nearestHub?.name ?? '—',
      distanceKm: nearestHub?.distanceKm ?? 0,
      productionGap: Math.round((nearestHub?.production ?? 0) - item.production),
    };
  });

  return { hubs, needsSupply };
}

function RegionalSupplyRouting() {
  const [selectedCrop, setSelectedCrop] = useState('cassava');
  const { hubs, needsSupply } = useMemo(() => computeRoutingData(selectedCrop), [selectedCrop]);

  const selectClass = 'rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500';
  const thClass = 'px-3 py-2 font-semibold text-gray-600 dark:text-gray-300 text-left';
  const tdClass = 'px-3 py-2 text-gray-700 dark:text-gray-300';

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Crop</label>
        <select className={selectClass} value={selectedCrop} onChange={(e) => setSelectedCrop(e.target.value)}>
          {crops.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Supply Hubs */}
        <div>
          <h5 className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide mb-2">Supply Hubs (Top 5)</h5>
          <div className="overflow-hidden rounded-xl border border-green-200 dark:border-green-800">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-green-50 dark:bg-green-900/20">
                  <th className={thClass}>District</th>
                  <th className={thClass}>Province</th>
                  <th className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-300 text-right">Production (t)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-green-100 dark:divide-green-900/30">
                {hubs.map((h) => (
                  <tr key={h.districtId} className="bg-white dark:bg-gray-800">
                    <td className={tdClass + ' font-medium'}>{h.districtName}</td>
                    <td className={tdClass}>{h.province}</td>
                    <td className="px-3 py-2 text-right font-semibold text-green-700 dark:text-green-400">{formatNumber(h.production)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Needs Supply */}
        <div>
          <h5 className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wide mb-2">Needs Supply (Bottom 5)</h5>
          <div className="overflow-hidden rounded-xl border border-red-200 dark:border-red-800">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-red-50 dark:bg-red-900/20">
                  <th className={thClass}>District</th>
                  <th className={thClass}>Nearest Hub</th>
                  <th className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-300 text-right">Gap (t)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-100 dark:divide-red-900/30">
                {needsSupply.map((row) => (
                  <tr key={row.lowDistrict} className="bg-white dark:bg-gray-800">
                    <td className={tdClass + ' font-medium'}>{row.lowDistrict}</td>
                    <td className={tdClass}>{row.nearestHub} <span className="text-gray-400 dark:text-gray-500">({row.distanceKm} km)</span></td>
                    <td className="px-3 py-2 text-right font-semibold text-red-700 dark:text-red-400">{formatNumber(row.productionGap)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Routing Table */}
      <div>
        <h5 className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide mb-2">Supply Routing Summary</h5>
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700">
                <th className={thClass}>Low District</th>
                <th className={thClass}>Nearest Supply Hub</th>
                <th className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-300 text-right">Distance (km)</th>
                <th className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-300 text-right">Production Gap (t)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
              {needsSupply.map((row) => (
                <tr key={row.lowDistrict}>
                  <td className={tdClass + ' font-medium'}>{row.lowDistrict}</td>
                  <td className={tdClass}>{row.nearestHub}</td>
                  <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{row.distanceKm}</td>
                  <td className="px-3 py-2 text-right font-semibold text-primary-600 dark:text-primary-400">{formatNumber(row.productionGap)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">* Distances are straight-line (Haversine). Actual road distances may differ.</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 6 — Smart Tools
// ---------------------------------------------------------------------------

const SMART_TOOLS: { id: SmartToolId; label: string; icon: React.ReactNode; description: string; color: string }[] = [
  {
    id: 'prediction',
    label: 'Prediction Simulator',
    icon: <Activity className="w-5 h-5" />,
    description: 'Simulate the impact of yield improvements and area expansion on future production for any district, crop, and season.',
    color: 'bg-blue-600',
  },
  {
    id: 'supply-gap',
    label: 'Supply Gap Finder',
    icon: <Scale className="w-5 h-5" />,
    description: 'Identify which districts produce surplus or face food deficits for a selected crop, and find the nearest supply sources.',
    color: 'bg-amber-600',
  },
  {
    id: 'opportunity',
    label: 'Opportunity Finder',
    icon: <Star className="w-5 h-5" />,
    description: 'Scan all districts and crops to surface improvement, investment, risk, and intensification opportunities based on NISR data.',
    color: 'bg-green-600',
  },
  {
    id: 'routing',
    label: 'Regional Supply Routing',
    icon: <Navigation className="w-5 h-5" />,
    description: 'Find the top supply hubs and identify which low-production districts should be supplied from which hub, with distances.',
    color: 'bg-purple-600',
  },
];

function SmartToolsTab() {
  const [activeTool, setActiveTool] = useState<SmartToolId>('prediction');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-primary-50 dark:bg-primary-900/20 rounded-xl border border-primary-200 dark:border-primary-800 p-4">
        <div className="flex items-center gap-2 mb-1">
          <Wrench className="w-4 h-4 text-primary-600 dark:text-primary-400" />
          <span className="text-sm font-bold text-primary-800 dark:text-primary-200">Smart Agricultural Tools</span>
        </div>
        <p className="text-xs text-primary-700 dark:text-primary-300">
          Data-powered tools to simulate scenarios, identify supply gaps, discover opportunities, and plan regional supply routing — all grounded in NISR agricultural data.
        </p>
      </div>

      {/* Tool selector cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {SMART_TOOLS.map((tool) => (
          <button
            key={tool.id}
            onClick={() => setActiveTool(tool.id)}
            className={`text-left rounded-xl border-2 p-4 transition-all ${
              activeTool === tool.id
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-md'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className={`w-9 h-9 ${tool.color} rounded-lg flex items-center justify-center text-white mb-2`}>
              {tool.icon}
            </div>
            <p className={`text-sm font-semibold mb-1 ${activeTool === tool.id ? 'text-primary-700 dark:text-primary-300' : 'text-gray-800 dark:text-gray-100'}`}>
              {tool.label}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug">{tool.description}</p>
            <div className="mt-2 flex items-center gap-1">
              {activeTool === tool.id ? (
                <><ChevronUp className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" /><span className="text-xs text-primary-600 dark:text-primary-400 font-medium">Active</span></>
              ) : (
                <><ChevronDown className="w-3.5 h-3.5 text-gray-400" /><span className="text-xs text-gray-400">Open</span></>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Active tool panel */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-200 dark:border-gray-700">
          {SMART_TOOLS.find((t) => t.id === activeTool) && (
            <>
              <div className={`w-7 h-7 ${SMART_TOOLS.find((t) => t.id === activeTool)!.color} rounded-lg flex items-center justify-center text-white`}>
                {SMART_TOOLS.find((t) => t.id === activeTool)!.icon}
              </div>
              <h4 className="text-sm font-bold text-gray-800 dark:text-gray-100">
                {SMART_TOOLS.find((t) => t.id === activeTool)!.label}
              </h4>
            </>
          )}
        </div>

        {activeTool === 'prediction' && <PredictionSimulator />}
        {activeTool === 'supply-gap' && <SupplyGapFinder />}
        {activeTool === 'opportunity' && <OpportunityFinder />}
        {activeTool === 'routing' && <RegionalSupplyRouting />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab bar
// ---------------------------------------------------------------------------

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'irrigation', label: 'Irrigation', icon: <Droplets className="w-4 h-4" /> },
  { id: 'soil', label: 'Soil & Fertility', icon: <Leaf className="w-4 h-4" /> },
  { id: 'postharvest', label: 'Post-Harvest', icon: <Package className="w-4 h-4" /> },
  { id: 'productivity', label: 'Productivity', icon: <TrendingUp className="w-4 h-4" /> },
  { id: 'export', label: 'Export Markets', icon: <Globe className="w-4 h-4" /> },
  { id: 'smarttools', label: 'Smart Tools', icon: <Wrench className="w-4 h-4" /> },
];

interface TabBarProps { activeTab: TabId; onChange: (t: TabId) => void; }

function TabBar({ activeTab, onChange }: TabBarProps) {
  return (
    <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 rounded-t-xl mb-0">
      <div className="overflow-x-auto">
        <div className="flex gap-0 min-w-max">
          {TABS.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                onClick={() => onChange(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-primary-600 dark:border-primary-400 text-primary-700 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
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
  const [activeTab, setActiveTab] = useState<TabId>('irrigation');

  const irrigationGap = useMemo(() => computeIrrigationData(), [dataVersion]);
  const soilDistricts = useMemo(() => computeSoilData(), [dataVersion]);
  const cropSummary = useMemo(() => computePostHarvestData(), [dataVersion]);
  const cropGrowth = useMemo(() => computeProductivityData(), [dataVersion]);
  const scaleComparison = useMemo(() => computeScaleComparison(), [dataVersion]);
  const topExportDistricts = useMemo(() => computeExportData(), [dataVersion]);
  const cashTrend = useMemo(() => computeCashProdTrend(), [dataVersion]);

  return (
    <div>
      {/* Page header */}
      <div className="bg-gradient-to-r from-primary-700 to-primary-900 rounded-xl p-5 sm:p-6 mb-6 text-white">
        <h2 className="text-lg sm:text-xl font-bold mb-2">Agricultural Solutions for Rwanda</h2>
        <p className="text-sm text-primary-100 leading-relaxed max-w-3xl">
          Use data to develop innovative solutions that address real agricultural challenges facing Rwanda. Solutions address small-scale irrigation, soil conservation, post-harvest storage, productivity, and export market opportunities — all informed by NISR data and designed for tangible impact on farmers, planners, and policymakers.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {['NISR Data-Driven', 'Farmer-Focused', 'Policy-Ready', 'All 30 Districts'].map((tag) => (
            <span key={tag} className="px-2.5 py-1 bg-white/20 rounded-full text-xs font-medium">{tag}</span>
          ))}
        </div>
      </div>

      {/* Tab bar + content */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <TabBar activeTab={activeTab} onChange={setActiveTab} />
        <div className="bg-gray-50 dark:bg-gray-900 p-4 sm:p-6">
          {activeTab === 'irrigation' && <IrrigationTab irrigationData={irrigationGap} />}
          {activeTab === 'soil' && <SoilTab soilDistricts={soilDistricts} />}
          {activeTab === 'postharvest' && <PostHarvestTab cropSummary={cropSummary} />}
          {activeTab === 'productivity' && <ProductivityTab cropGrowth={cropGrowth} scaleComparison={scaleComparison} />}
          {activeTab === 'export' && <ExportMarketsTab topExportDistricts={topExportDistricts} cashTrend={cashTrend} />}
          {activeTab === 'smarttools' && <SmartToolsTab />}
        </div>
      </div>

      {/* Data foundation note */}
      <div className="bg-primary-50 dark:bg-primary-900/20 rounded-xl border border-primary-200 dark:border-primary-800 p-5 mt-6">
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
  );
}
