import { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { Coffee, Leaf, TrendingUp, TrendingDown, RefreshCw, Wifi } from 'lucide-react';
import {
  fetchCashCropData,
  fetchFullYieldTable,
  getCashCropChartData,
  getCashCropStats,
  type CashCropDataPoint,
  type LiveYieldPoint,
} from '../services/cashCrops';
import { useTheme } from '../context/ThemeContext';
import { formatNumber } from '../utils/calculations';
import { districts, crops } from '../services/agricultureData';
import { PXWEB_DISTRICT_MAP, PXWEB_CROP_MAP, PXWEB_SEASON_MAP } from '../config/api';

// ---------------------------------------------------------------------------
// Chart style helper
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
// Stat card component
// ---------------------------------------------------------------------------
function StatCard({
  label, value, unit, change, changeLabel, icon, colorClass,
}: {
  label: string; value: string; unit?: string;
  change?: number; changeLabel?: string;
  icon: React.ReactNode; colorClass: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{label}</p>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl font-bold text-gray-900 dark:text-white">{value}</span>
            {unit && <span className="text-xs text-gray-400 dark:text-gray-500">{unit}</span>}
          </div>
          {change !== undefined && (
            <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
              {change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {change > 0 ? '+' : ''}{change}% {changeLabel}
            </div>
          )}
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function CashCrops() {
  const [cashData, setCashData] = useState<CashCropDataPoint[]>([]);
  const [yieldData, setYieldData] = useState<LiveYieldPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'coffee' | 'tea' | 'yield'>('overview');
  const cs = useChartStyle();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([fetchCashCropData(), fetchFullYieldTable()])
      .then(([cash, yield_]) => {
        if (cancelled) return;
        setCashData(cash);
        setYieldData(yield_);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load data');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const chartData = useMemo(() => getCashCropChartData(cashData), [cashData]);
  const coffeeStats = useMemo(() => getCashCropStats(cashData, 'Coffee'), [cashData]);
  const teaStats = useMemo(() => getCashCropStats(cashData, 'Tea'), [cashData]);

  // Build yield heatmap data from live NISR yield table
  const yieldTableData = useMemo(() => {
    if (yieldData.length === 0) return [];
    // Build reverse lookup maps: code → readable name
    const districtNameMap: Record<string, string> = {};
    for (const [code, distId] of Object.entries(PXWEB_DISTRICT_MAP)) {
      const d = districts.find((x) => x.id === distId);
      if (d) districtNameMap[code] = d.name;
    }
    const cropNameMap: Record<string, string> = {};
    for (const [code, cropId] of Object.entries(PXWEB_CROP_MAP)) {
      const c = crops.find((x) => x.id === cropId);
      if (c) cropNameMap[code] = c.name;
    }
    return yieldData.map((row) => ({
      season: PXWEB_SEASON_MAP[row.seasonCode] ?? row.seasonCode,
      district: districtNameMap[row.districtCode] ?? `District ${row.districtCode}`,
      crop: cropNameMap[row.cropCode] ?? `Crop ${row.cropCode}`,
      yieldTPerHa: Math.round(row.yieldKgPerHa / 10) / 100,
    }));
  }, [yieldData]);

  // Top 10 highest yield district+crop combinations
  const topYields = useMemo(() =>
    [...yieldTableData]
      .sort((a, b) => b.yieldTPerHa - a.yieldTPerHa)
      .slice(0, 10),
  [yieldTableData]);

  // Summary by crop from live yield table
  const cropYieldSummary = useMemo(() => {
    const byCrop = new Map<string, number[]>();
    for (const row of yieldTableData) {
      if (!byCrop.has(row.crop)) byCrop.set(row.crop, []);
      byCrop.get(row.crop)!.push(row.yieldTPerHa);
    }
    return Array.from(byCrop.entries())
      .map(([crop, vals]) => ({
        crop,
        avgYield: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 100) / 100,
        maxYield: Math.round(Math.max(...vals) * 100) / 100,
        count: vals.length,
        color: crops.find((c) => c.name === crop)?.color ?? '#6366f1',
      }))
      .sort((a, b) => b.avgYield - a.avgYield);
  }, [yieldTableData]);

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'coffee' as const, label: 'Coffee', icon: <Coffee className="w-4 h-4" /> },
    { id: 'tea' as const, label: 'Tea', icon: <Leaf className="w-4 h-4" /> },
    { id: 'yield' as const, label: 'Live Yield Table', icon: <Wifi className="w-4 h-4" /> },
  ];

  return (
    <div>
      {/* Hero banner */}
      <div className="bg-gradient-to-r from-emerald-800 to-teal-700 rounded-xl p-5 sm:p-6 mb-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
            <Coffee className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-lg sm:text-xl font-bold">Cash Crops — Coffee & Tea</h2>
        </div>
        <p className="text-sm text-emerald-100 leading-relaxed max-w-3xl">
          Live production data for Rwanda's two main export cash crops, fetched directly from the NISR PXWeb API. Coffee and Tea are critical to Rwanda's foreign exchange earnings and rural livelihoods.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 items-center">
          <span className="px-2.5 py-1 bg-white/20 rounded-full text-xs font-medium">NISR Live Data</span>
          <span className="px-2.5 py-1 bg-white/20 rounded-full text-xs font-medium">2016–2022</span>
          <span className="px-2.5 py-1 bg-white/20 rounded-full text-xs font-medium">Full Yield Table</span>
          {loading && (
            <span className="flex items-center gap-1 px-2.5 py-1 bg-white/30 rounded-full text-xs font-medium">
              <RefreshCw className="w-3 h-3 animate-spin" /> Loading from API…
            </span>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6 text-sm text-red-700 dark:text-red-300">
          Failed to fetch live data: {error}. Showing cached data.
        </div>
      )}

      {/* Summary stat cards */}
      {(coffeeStats || teaStats) && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {coffeeStats && (
            <>
              <StatCard
                label="Coffee Production (latest)"
                value={formatNumber(coffeeStats.latestProduction)}
                unit={`t (${coffeeStats.latestYear})`}
                change={coffeeStats.yoyChangePct}
                changeLabel="YoY"
                icon={<Coffee className="w-5 h-5" />}
                colorClass="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
              />
              <StatCard
                label="Coffee Trend (2016→2022)"
                value={`${coffeeStats.totalGrowthPct > 0 ? '+' : ''}${coffeeStats.totalGrowthPct}%`}
                unit="total change"
                icon={coffeeStats.totalGrowthPct >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                colorClass={coffeeStats.totalGrowthPct >= 0 ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300'}
              />
            </>
          )}
          {teaStats && (
            <>
              <StatCard
                label="Tea Production (latest)"
                value={formatNumber(teaStats.latestProduction)}
                unit={`t (${teaStats.latestYear})`}
                change={teaStats.yoyChangePct}
                changeLabel="YoY"
                icon={<Leaf className="w-5 h-5" />}
                colorClass="bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300"
              />
              <StatCard
                label="Tea Trend (2016→2022)"
                value={`+${teaStats.totalGrowthPct}%`}
                unit="total change"
                icon={<TrendingUp className="w-5 h-5" />}
                colorClass="bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300"
              />
            </>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
          <div className="flex min-w-max">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-primary-600 dark:border-primary-400 text-primary-700 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-900 p-4 sm:p-6">

          {/* ── Overview ── */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">
                  Coffee vs Tea — Annual Production (tons) · 2016–2022
                </h3>
                <div style={{ height: 320 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={cs.grid} />
                      <XAxis dataKey="year" tick={{ fontSize: 12, fill: cs.axis }} stroke={cs.axis} />
                      <YAxis tick={{ fontSize: 11, fill: cs.axis }} stroke={cs.axis} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        contentStyle={cs.tt}
                        formatter={(v) => [formatNumber(v as number) + ' t', '']}
                      />
                      <Legend wrapperStyle={{ fontSize: 12, color: cs.isDark ? '#9ca3af' : undefined }} />
                      <Line type="monotone" dataKey="Coffee" stroke="#d97706" strokeWidth={2.5} dot={{ r: 5, fill: '#d97706' }} activeDot={{ r: 7 }} />
                      <Line type="monotone" dataKey="Tea" stroke="#0d9488" strokeWidth={2.5} dot={{ r: 5, fill: '#0d9488' }} activeDot={{ r: 7 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Coffee insight */}
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Coffee className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                    <span className="text-sm font-bold text-amber-800 dark:text-amber-300">Coffee — Key Insights</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-amber-900 dark:text-amber-200">
                    <li>• Peak production: {coffeeStats ? `${formatNumber(coffeeStats.peakProduction)} t (${coffeeStats.peakYear})` : '—'}</li>
                    <li>• Latest: {coffeeStats ? `${formatNumber(coffeeStats.latestProduction)} t (${coffeeStats.latestYear})` : '—'}</li>
                    <li>• Trend: <strong>declining</strong> — dropped from 23,375 t (2019) to 18,945 t (2022)</li>
                    <li>• Action: requires investment in seedling renewal and farmer support programs</li>
                  </ul>
                </div>

                {/* Tea insight */}
                <div className="bg-teal-50 dark:bg-teal-900/20 rounded-xl border border-teal-200 dark:border-teal-800 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Leaf className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                    <span className="text-sm font-bold text-teal-800 dark:text-teal-300">Tea — Key Insights</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-teal-900 dark:text-teal-200">
                    <li>• Latest: {teaStats ? `${formatNumber(teaStats.latestProduction)} t (${teaStats.latestYear})` : '—'}</li>
                    <li>• Trend: <strong>growing strongly</strong> — +{teaStats?.totalGrowthPct}% since 2016</li>
                    <li>• Every year shows consecutive growth (2016–2022)</li>
                    <li>• Action: expand processing capacity and pursue premium export markets</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* ── Coffee detail ── */}
          {activeTab === 'coffee' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">Coffee Production Trend (tons) · Source: NISR</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Rwanda produces primarily Arabica coffee, exported to specialty markets in Europe, USA, and Japan.</p>
                <div style={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData}
                      margin={{ top: 5, right: 20, bottom: 5, left: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={cs.grid} />
                      <XAxis dataKey="year" tick={{ fontSize: 12, fill: cs.axis }} stroke={cs.axis} />
                      <YAxis tick={{ fontSize: 11, fill: cs.axis }} stroke={cs.axis} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} domain={[0, 'auto']} />
                      <Tooltip contentStyle={cs.tt} formatter={(v) => [formatNumber(v as number) + ' t', 'Coffee']} />
                      <ReferenceLine y={coffeeStats?.latestProduction ?? 0} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'Latest', fill: '#f59e0b', fontSize: 11 }} />
                      <Bar dataKey="Coffee" fill="#d97706" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Annual Data — Coffee</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 text-gray-600 dark:text-gray-300 font-semibold">Year</th>
                      <th className="text-right py-2 text-gray-600 dark:text-gray-300 font-semibold">Production (t)</th>
                      <th className="text-right py-2 text-gray-600 dark:text-gray-300 font-semibold">YoY Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chartData.map((row, i) => {
                      const prev = chartData[i - 1];
                      const change = prev ? ((row.Coffee - prev.Coffee) / prev.Coffee * 100) : null;
                      return (
                        <tr key={row.year} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/40">
                          <td className="py-2 text-gray-700 dark:text-gray-200 font-medium">{row.year}</td>
                          <td className="py-2 text-right font-semibold text-gray-900 dark:text-white">{formatNumber(row.Coffee)}</td>
                          <td className={`py-2 text-right text-xs font-medium ${change === null ? 'text-gray-400' : change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                            {change === null ? '—' : `${change > 0 ? '+' : ''}${change.toFixed(1)}%`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Tea detail ── */}
          {activeTab === 'tea' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">Tea Production Trend (tons) · Source: NISR</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Rwanda's tea sector has grown consistently, with major plantations in Western Province. Rwanda tea is exported primarily to the UK and Middle East.</p>
                <div style={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={cs.grid} />
                      <XAxis dataKey="year" tick={{ fontSize: 12, fill: cs.axis }} stroke={cs.axis} />
                      <YAxis tick={{ fontSize: 11, fill: cs.axis }} stroke={cs.axis} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip contentStyle={cs.tt} formatter={(v) => [formatNumber(v as number) + ' t', 'Tea']} />
                      <Bar dataKey="Tea" fill="#0d9488" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Annual Data — Tea</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 text-gray-600 dark:text-gray-300 font-semibold">Year</th>
                      <th className="text-right py-2 text-gray-600 dark:text-gray-300 font-semibold">Production (t)</th>
                      <th className="text-right py-2 text-gray-600 dark:text-gray-300 font-semibold">YoY Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chartData.map((row, i) => {
                      const prev = chartData[i - 1];
                      const change = prev ? ((row.Tea - prev.Tea) / prev.Tea * 100) : null;
                      return (
                        <tr key={row.year} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/40">
                          <td className="py-2 text-gray-700 dark:text-gray-200 font-medium">{row.year}</td>
                          <td className="py-2 text-right font-semibold text-gray-900 dark:text-white">{formatNumber(row.Tea)}</td>
                          <td className={`py-2 text-right text-xs font-medium ${change === null ? 'text-gray-400' : change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                            {change === null ? '—' : `${change > 0 ? '+' : ''}${change.toFixed(1)}%`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Live Yield Table ── */}
          {activeTab === 'yield' && (
            <div className="space-y-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 text-sm text-blue-800 dark:text-blue-300">
                <p className="font-semibold mb-1">Live data from NISR PXWeb API</p>
                <p className="text-xs">This table is fetched live using a POST request with an empty query to retrieve all data from the yield.px table. {yieldData.length > 0 ? `${yieldData.length.toLocaleString()} data points loaded.` : 'Loading…'}</p>
              </div>

              {/* Crop yield summary */}
              {cropYieldSummary.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">Average Yield by Crop (Live NISR Data) — t/ha</h3>
                  <div style={{ height: 280 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={cropYieldSummary} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 80 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={cs.grid} horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 11, fill: cs.axis }} stroke={cs.axis} tickFormatter={(v) => `${v} t/ha`} />
                        <YAxis type="category" dataKey="crop" tick={{ fontSize: 11, fill: cs.axis }} stroke={cs.axis} width={80} />
                        <Tooltip contentStyle={cs.tt} formatter={(v) => [`${Number(v).toFixed(2)} t/ha`, 'Avg Yield']} />
                        <Bar dataKey="avgYield" radius={[0, 4, 4, 0]}>
                          {cropYieldSummary.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Top yields table */}
              {topYields.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 overflow-x-auto">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
                    Top 10 District × Crop Yield Combinations (Live Data)
                  </h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-2 px-2 text-gray-600 dark:text-gray-300 font-semibold">#</th>
                        <th className="text-left py-2 px-2 text-gray-600 dark:text-gray-300 font-semibold">Season</th>
                        <th className="text-left py-2 px-2 text-gray-600 dark:text-gray-300 font-semibold">District</th>
                        <th className="text-left py-2 px-2 text-gray-600 dark:text-gray-300 font-semibold">Crop</th>
                        <th className="text-right py-2 px-2 text-gray-600 dark:text-gray-300 font-semibold">Yield (t/ha)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topYields.map((row, i) => (
                        <tr key={i} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/40">
                          <td className="py-2 px-2 text-gray-400 dark:text-gray-500 text-xs">{i + 1}</td>
                          <td className="py-2 px-2 text-gray-700 dark:text-gray-200">Season {row.season}</td>
                          <td className="py-2 px-2 text-gray-700 dark:text-gray-200 font-medium">{row.district}</td>
                          <td className="py-2 px-2 text-gray-700 dark:text-gray-200">{row.crop}</td>
                          <td className="py-2 px-2 text-right font-bold text-primary-600 dark:text-primary-400">{row.yieldTPerHa}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {yieldData.length === 0 && !loading && (
                <div className="text-center py-10 text-gray-500 dark:text-gray-400 text-sm">
                  No live yield data available. Check NISR API connectivity.
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* API source note */}
      <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-xs text-gray-500 dark:text-gray-400">
        <strong className="text-gray-600 dark:text-gray-300">Data sources:</strong>
        &nbsp;Cash crops (Coffee/Tea): NISR PXWeb — <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">cash_crop.px</code>
        &nbsp;|&nbsp;Yield table: NISR PXWeb — <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">yield.px</code>
        &nbsp;(POST with empty query, all data)
        &nbsp;· Updated: June 2024
      </div>
    </div>
  );
}
