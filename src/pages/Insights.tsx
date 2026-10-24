import { useState, useMemo } from 'react';
import type { Season, InsightType } from '../types/agriculture';
import { crops, getAvailableYears, districts, getAllData } from '../services/agricultureData';
import { generateInsights, getProductionByDistrict } from '../utils/calculations';
import { getTopDistricts, getPracticeData, getHarvestData, getLargeScaleData } from '../services/nisr';
import InsightCard from '../components/ui/InsightCard';
import AIAnalysisPanel from '../components/ui/AIAnalysisPanel';
import { useDataVersion } from '../hooks/useAgricultureData';
import { Lightbulb, Filter, AlertTriangle, Droplets, TrendingUp, Globe } from 'lucide-react';

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

  // Track 1 Impact Analysis alerts
  const track1Alerts = useMemo(() => {
    // Alert 1: Post-harvest loss — bottom 3 districts by avg harvestRatio
    const hd = getHarvestData();
    const postHarvestRisk: { districtName: string; avgRatio: number }[] = [];
    if (hd.length > 0) {
      const ratioMap = new Map<string, { name: string; vals: number[] }>();
      for (const p of hd) {
        if (!ratioMap.has(p.districtId)) ratioMap.set(p.districtId, { name: p.districtName, vals: [] });
        ratioMap.get(p.districtId)!.vals.push(p.harvestRatio);
      }
      Array.from(ratioMap.entries())
        .map(([, v]) => ({ districtName: v.name, avgRatio: Math.round(v.vals.reduce((a, b) => a + b, 0) / v.vals.length * 10) / 10 }))
        .sort((a, b) => a.avgRatio - b.avgRatio)
        .slice(0, 3)
        .forEach((r) => postHarvestRisk.push(r));
    }

    // Alert 2: Irrigation opportunity — no irrigation AND below national avg yield
    const pd = getPracticeData();
    const irrigationOpportunity: string[] = [];
    if (pd.length > 0) {
      const ad = getAllData();
      const adYears = ad.filter((p) => p.season === 'A').map((p) => p.year);
      const latestYear = adYears.length > 0 ? Math.max(...adYears) : 2023;
      const latestA = ad.filter((p) => p.season === 'A' && p.year === latestYear);
      const natAvgYield = latestA.length > 0
        ? latestA.reduce((s, p) => s + p.yieldPerHa, 0) / latestA.length : 0;

      // Districts with zero irrigation
      const irrigMap = new Map<string, number>();
      for (const p of pd.filter((x) => x.practice === 'Modern irrigated land')) {
        irrigMap.set(p.districtId, (irrigMap.get(p.districtId) ?? 0) + p.areaHa);
      }
      const noIrrig = new Set(districts.filter((d) => (irrigMap.get(d.id) ?? 0) === 0).map((d) => d.id));

      // Districts below national avg yield
      const yieldByDistrict = new Map<string, number[]>();
      for (const p of latestA) {
        if (!yieldByDistrict.has(p.districtId)) yieldByDistrict.set(p.districtId, []);
        yieldByDistrict.get(p.districtId)!.push(p.yieldPerHa);
      }
      for (const [distId, vals] of yieldByDistrict) {
        const avgY = vals.reduce((a, b) => a + b, 0) / vals.length;
        if (noIrrig.has(distId) && avgY < natAvgYield) {
          const d = districts.find((x) => x.id === distId);
          if (d) irrigationOpportunity.push(d.name);
        }
      }
    }

    // Alert 3: Intensification — large-scale yield > 2× small-scale
    const lsd = getLargeScaleData();
    const intensificationTargets: { cropName: string; districtName: string }[] = [];
    if (lsd.length > 0) {
      const ad = getAllData();
      const adYears = ad.filter((p) => p.season === 'A').map((p) => p.year);
      const latestYear = adYears.length > 0 ? Math.max(...adYears) : 2023;
      const lsMap = new Map<string, number[]>();
      for (const p of lsd.filter((x) => x.season === 'A')) {
        const key = `${p.cropId}::${p.districtId}`;
        if (!lsMap.has(key)) lsMap.set(key, []);
        lsMap.get(key)!.push(p.yieldKgPerHa);
      }
      const ssMap = new Map<string, number[]>();
      for (const p of ad.filter((x) => x.season === 'A' && x.year === latestYear)) {
        const key = `${p.cropId}::${p.districtId}`;
        if (!ssMap.has(key)) ssMap.set(key, []);
        ssMap.get(key)!.push(p.yieldPerHa * 1000);
      }
      for (const [key, lsVals] of lsMap) {
        const ssVals = ssMap.get(key);
        if (!ssVals) continue;
        const lsAvg = lsVals.reduce((a, b) => a + b, 0) / lsVals.length;
        const ssAvg = ssVals.reduce((a, b) => a + b, 0) / ssVals.length;
        if (ssAvg > 0 && lsAvg > ssAvg * 2) {
          const [cropId, districtId] = key.split('::');
          const c = crops.find((x) => x.id === cropId);
          const d = districts.find((x) => x.id === districtId);
          if (c && d) intensificationTargets.push({ cropName: c.name, districtName: d.name });
        }
      }
      intensificationTargets.splice(5);
    }

    // Alert 4: Export opportunity — top 3 combined export crop districts
    const exportCropIds = ['irish-potato', 'wheat', 'rice'];
    const ad = getAllData();
    const adYears = ad.filter((p) => p.season === 'A').map((p) => p.year);
    const latestYear = adYears.length > 0 ? Math.max(...adYears) : 2023;
    const exportMap = new Map<string, number>();
    for (const p of ad.filter((x) => x.season === 'A' && x.year === latestYear && exportCropIds.includes(x.cropId))) {
      exportMap.set(p.districtId, (exportMap.get(p.districtId) ?? 0) + p.production);
    }
    const topExport = Array.from(exportMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([distId, prod]) => {
        const d = districts.find((x) => x.id === distId);
        return { name: d?.name ?? distId, production: Math.round(prod) };
      });

    return { postHarvestRisk, irrigationOpportunity: irrigationOpportunity.slice(0, 5), intensificationTargets, topExport };
  }, [dataVersion]);

  return (
    <div>
      {/* Filter bar */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4 mb-4 sm:mb-6">
        <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-gray-700 dark:text-gray-200">
          <Filter className="w-4 h-4" /> Filters
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col flex-1 min-w-[140px]">
            <label className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">Crop</label>
            <select value={cropId} onChange={(e) => setCropId(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 w-full">
              {crops.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">Season</label>
            <div className="flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
              {(['A', 'B', 'C'] as Season[]).map((s) => (
                <button key={s} onClick={() => setSeason(s)}
                  className={`px-3 py-2 text-sm font-medium ${season === s ? 'bg-primary-600 text-white' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">Year</label>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              {getAvailableYears().map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">Severity</label>
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
            { key: 'critical', label: 'Critical', color: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30' },
            { key: 'warning', label: 'Warning', color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30' },
            { key: 'positive', label: 'Positive', color: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30' },
            { key: 'info', label: 'Info', color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30' },
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

      {/* Track 1 Impact Analysis */}
      <div className="mb-4 sm:mb-6">
        <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary-600 dark:text-primary-400" />
          Track 1 Impact Analysis
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">

          {/* Alert 1: Post-harvest loss */}
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-orange-600" />
              <span className="text-sm font-bold text-orange-800 dark:text-orange-200">Post-Harvest Loss Risk</span>
            </div>
            {track1Alerts.postHarvestRisk.length === 0 ? (
              <p className="text-xs text-orange-600 dark:text-orange-400">Data loading...</p>
            ) : (
              <div className="space-y-1.5">
                <p className="text-xs text-orange-700 dark:text-orange-300 mb-2">Districts with lowest average harvest efficiency:</p>
                {track1Alerts.postHarvestRisk.map((r) => (
                  <div key={r.districtName} className="flex items-center justify-between">
                    <span className="text-xs font-medium text-orange-800 dark:text-orange-200">{r.districtName}</span>
                    <span className="text-xs font-bold text-orange-600 dark:text-orange-400">{r.avgRatio}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Alert 2: Irrigation opportunity */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Droplets className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-bold text-blue-800 dark:text-blue-200">Irrigation Opportunity</span>
            </div>
            {track1Alerts.irrigationOpportunity.length === 0 ? (
              <p className="text-xs text-blue-600 dark:text-blue-400">
                {getPracticeData().length === 0 ? 'Data loading...' : 'No irrigation gaps detected.'}
              </p>
            ) : (
              <div>
                <p className="text-xs text-blue-700 dark:text-blue-300 mb-2">Districts with no irrigation and below-average yield:</p>
                <div className="flex flex-wrap gap-1.5">
                  {track1Alerts.irrigationOpportunity.map((n) => (
                    <span key={n} className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 text-xs rounded-full">{n}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Alert 3: Intensification target */}
          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-bold text-purple-800 dark:text-purple-200">Intensification Target</span>
            </div>
            {track1Alerts.intensificationTargets.length === 0 ? (
              <p className="text-xs text-purple-600 dark:text-purple-400">
                {getLargeScaleData().length === 0 ? 'Data loading...' : 'No intensification gaps detected.'}
              </p>
            ) : (
              <div>
                <p className="text-xs text-purple-700 dark:text-purple-300 mb-2">Large-scale yield &gt;2× small-scale — improvement opportunity:</p>
                <div className="space-y-1">
                  {track1Alerts.intensificationTargets.map((t, i) => (
                    <div key={i} className="text-xs text-purple-800 dark:text-purple-200">
                      {t.cropName} — {t.districtName}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Alert 4: Export opportunity */}
          <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Globe className="w-4 h-4 text-teal-600" />
              <span className="text-sm font-bold text-teal-800 dark:text-teal-200">Export Opportunity</span>
            </div>
            {track1Alerts.topExport.length === 0 ? (
              <p className="text-xs text-teal-600 dark:text-teal-400">No export data available.</p>
            ) : (
              <div>
                <p className="text-xs text-teal-700 dark:text-teal-300 mb-2">Top districts for Irish Potato + Wheat + Rice (latest season):</p>
                <div className="space-y-1.5">
                  {track1Alerts.topExport.map((e, i) => (
                    <div key={e.name} className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-medium text-teal-800 dark:text-teal-200">
                        <span className="w-4 h-4 rounded-full bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                        {e.name}
                      </span>
                      <span className="text-xs font-semibold text-teal-600 dark:text-teal-400">{e.production.toLocaleString()} t</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

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
