import { useState } from 'react';
import {
  ChevronDown, ChevronUp, Loader2, AlertCircle,
  CheckCircle2, AlertTriangle, Lightbulb, BarChart2,
} from 'lucide-react';
import type { MistralAnalysis, DistrictAnalysisInput } from '../../services/mistral';
import { analyzeDistrict } from '../../services/mistral';

interface AIAnalysisPanelProps {
  input: DistrictAnalysisInput;
}

export default function AIAnalysisPanel({ input }: AIAnalysisPanelProps) {
  const [analysis, setAnalysis] = useState<MistralAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    setExpanded(true);
    setAnalysis(null);
    const t1 = setTimeout(() => {}, 5000);   // silent wait
    const t2 = setTimeout(() => {}, 15000);
    try {
      const result = await analyzeDistrict(input);
      setAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis could not be completed');
    } finally {
      clearTimeout(t1);
      clearTimeout(t2);
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <BarChart2 className="w-4 h-4 text-primary-600 flex-shrink-0" />
          <span className="text-sm font-semibold text-gray-800 truncate">
            District Analysis — {input.districtName} · {input.cropName}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!analysis && !loading && (
            <button
              onClick={handleAnalyze}
              className="text-xs px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 active:scale-95 transition-all font-medium whitespace-nowrap"
            >
              Generate Report
            </button>
          )}
          {analysis && !loading && (
            <>
              <button
                onClick={handleAnalyze}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                Refresh
              </button>
              <button
                onClick={() => setExpanded((v) => !v)}
                className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
                aria-label="Toggle analysis"
              >
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="px-4 py-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Loader2 className="w-4 h-4 animate-spin flex-shrink-0 text-primary-600" />
            <span>Analyzing {input.districtName} {input.cropName} data…</span>
          </div>
          <div className="mt-2 h-1 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-primary-400 rounded-full animate-pulse w-3/4" />
          </div>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="px-4 py-3 border-t border-red-100 bg-red-50">
          <div className="flex items-start gap-2 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Could not generate analysis</p>
              <p className="text-xs mt-0.5 text-red-500">{error}</p>
              <button
                onClick={handleAnalyze}
                className="text-xs mt-1.5 px-2 py-1 bg-white border border-red-200 hover:bg-red-50 rounded text-red-600 font-medium transition-colors"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {analysis && expanded && (
        <div className="px-4 py-4 space-y-4">
          {/* Summary */}
          <p className="text-sm text-gray-700 leading-relaxed border-l-4 border-primary-400 pl-3">
            {analysis.summary}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Strengths */}
            <div className="bg-green-50 rounded-lg p-3 border border-green-100">
              <div className="flex items-center gap-1.5 mb-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                <span className="text-xs font-semibold text-green-800">Umusaruro mwiza</span>
              </div>
              <ul className="space-y-1.5">
                {analysis.strengths.map((s, i) => (
                  <li key={i} className="text-xs text-gray-700 leading-snug flex gap-1.5">
                    <span className="text-green-500 flex-shrink-0 mt-0.5">▸</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>

            {/* Concerns */}
            <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
              <div className="flex items-center gap-1.5 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span className="text-xs font-semibold text-amber-800">Ibikenewe gutekereza</span>
              </div>
              <ul className="space-y-1.5">
                {analysis.concerns.map((c, i) => (
                  <li key={i} className="text-xs text-gray-700 leading-snug flex gap-1.5">
                    <span className="text-amber-500 flex-shrink-0 mt-0.5">▸</span>
                    {c}
                  </li>
                ))}
              </ul>
            </div>

            {/* Recommendations */}
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
              <div className="flex items-center gap-1.5 mb-2">
                <Lightbulb className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span className="text-xs font-semibold text-blue-800">Ingamba zishyirwaho</span>
              </div>
              <ul className="space-y-1.5">
                {analysis.recommendations.map((r, i) => (
                  <li key={i} className="text-xs text-gray-700 leading-snug flex gap-1.5">
                    <span className="text-blue-600 flex-shrink-0 font-semibold">{i + 1}.</span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Footer — source only, no technology mention */}
          <p className="text-xs text-gray-400 text-right pt-1">
            Source: NISR Rwanda · Season {input.season} {input.year}
          </p>
        </div>
      )}
    </div>
  );
}
