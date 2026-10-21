import { useState } from 'react';
import { Sparkles, ChevronDown, ChevronUp, Loader2, AlertCircle, CheckCircle2, AlertTriangle, Lightbulb } from 'lucide-react';
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
    try {
      const result = await analyzeDistrict(input);
      setAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get AI analysis');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-primary-50 to-emerald-50 border border-primary-200 rounded-xl overflow-hidden">
      {/* Header / trigger */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary-600 flex-shrink-0" />
          <span className="text-sm font-semibold text-primary-800">
            AI Analysis — {input.districtName} / {input.cropName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!analysis && !loading && (
            <button
              onClick={handleAnalyze}
              className="text-xs px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3" />
              Analyze with AI
            </button>
          )}
          {analysis && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-primary-600 hover:text-primary-800 transition-colors"
              aria-label="Toggle analysis"
            >
              {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          )}
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="px-4 pb-4 flex items-center gap-2 text-sm text-primary-700">
          <Loader2 className="w-4 h-4 animate-spin" />
          Mistral AI is analyzing {input.districtName}'s {input.cropName} data…
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="px-4 pb-4 flex items-start gap-2 text-sm text-red-700 bg-red-50 border-t border-red-200">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Analysis failed</p>
            <p className="text-xs mt-0.5 text-red-600">{error}</p>
            <button
              onClick={handleAnalyze}
              className="text-xs mt-1 underline text-red-700 hover:text-red-900"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      {analysis && expanded && (
        <div className="border-t border-primary-200 px-4 py-4 space-y-4">
          {/* Summary */}
          <p className="text-sm text-gray-700 leading-relaxed">{analysis.summary}</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Strengths */}
            <div className="bg-white rounded-lg p-3 border border-green-100">
              <div className="flex items-center gap-1.5 mb-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">Strengths</span>
              </div>
              <ul className="space-y-1.5">
                {analysis.strengths.map((s, i) => (
                  <li key={i} className="text-xs text-gray-600 leading-snug flex gap-1.5">
                    <span className="text-green-500 mt-0.5">•</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>

            {/* Concerns */}
            <div className="bg-white rounded-lg p-3 border border-amber-100">
              <div className="flex items-center gap-1.5 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Concerns</span>
              </div>
              <ul className="space-y-1.5">
                {analysis.concerns.map((c, i) => (
                  <li key={i} className="text-xs text-gray-600 leading-snug flex gap-1.5">
                    <span className="text-amber-500 mt-0.5">•</span>
                    {c}
                  </li>
                ))}
              </ul>
            </div>

            {/* Recommendations */}
            <div className="bg-white rounded-lg p-3 border border-blue-100">
              <div className="flex items-center gap-1.5 mb-2">
                <Lightbulb className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Recommendations</span>
              </div>
              <ul className="space-y-1.5">
                {analysis.recommendations.map((r, i) => (
                  <li key={i} className="text-xs text-gray-600 leading-snug flex gap-1.5">
                    <span className="text-blue-500 mt-0.5">{i + 1}.</span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Re-analyze button */}
          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-gray-400">Powered by Mistral AI · Based on NISR data</p>
            <button
              onClick={handleAnalyze}
              className="text-xs text-primary-600 hover:text-primary-800 underline"
            >
              Refresh analysis
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
