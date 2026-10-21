import { useState } from 'react';
import {
  Sparkles, ChevronDown, ChevronUp, Loader2,
  AlertCircle, CheckCircle2, AlertTriangle, Lightbulb, Cpu,
} from 'lucide-react';
import type { MistralAnalysis, DistrictAnalysisInput } from '../../services/mistral';
import { analyzeDistrict } from '../../services/mistral';

interface AIAnalysisPanelProps {
  input: DistrictAnalysisInput;
}

export default function AIAnalysisPanel({ input }: AIAnalysisPanelProps) {
  const [analysis, setAnalysis] = useState<MistralAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    setExpanded(true);
    setAnalysis(null);
    setLoadingMsg(`Contacting Mistral AI…`);

    // After 5 s, update message to signal retry is happening
    const timer1 = setTimeout(() => setLoadingMsg('Rate limit hit — retrying in a moment…'), 5000);
    const timer2 = setTimeout(() => setLoadingMsg('Still retrying — please wait…'), 15000);

    try {
      const result = await analyzeDistrict(input);
      setAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get AI analysis');
    } finally {
      clearTimeout(timer1);
      clearTimeout(timer2);
      setLoading(false);
      setLoadingMsg('');
    }
  };

  return (
    <div className="bg-gradient-to-br from-primary-50 to-emerald-50 border border-primary-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 text-primary-600 flex-shrink-0" />
          <span className="text-sm font-semibold text-primary-800 truncate">
            AI Analysis — {input.districtName} / {input.cropName}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!analysis && !loading && (
            <button
              onClick={handleAnalyze}
              className="text-xs px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 active:scale-95 transition-all font-medium flex items-center gap-1.5 whitespace-nowrap"
            >
              <Sparkles className="w-3 h-3" />
              Analyze with AI
            </button>
          )}
          {analysis && !loading && (
            <>
              <button
                onClick={handleAnalyze}
                className="text-xs text-primary-600 hover:text-primary-800 underline"
              >
                Refresh
              </button>
              <button
                onClick={() => setExpanded((v) => !v)}
                className="p-1 text-primary-600 hover:text-primary-800 transition-colors"
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
        <div className="px-4 pb-4 border-t border-primary-100">
          <div className="flex items-center gap-2 text-sm text-primary-700 mt-3">
            <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
            <span>{loadingMsg}</span>
          </div>
          <div className="mt-2 h-1.5 bg-primary-100 rounded-full overflow-hidden">
            <div className="h-full bg-primary-400 rounded-full animate-pulse w-2/3" />
          </div>
          <p className="text-xs text-primary-500 mt-1.5">
            If the API is rate-limited, a local analysis will be generated automatically.
          </p>
        </div>
      )}

      {/* Error state — only shown for non-rate-limit errors */}
      {error && !loading && (
        <div className="px-4 pb-4 border-t border-red-200 bg-red-50">
          <div className="flex items-start gap-2 text-sm text-red-700 mt-3">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Analysis failed</p>
              <p className="text-xs mt-0.5 text-red-600 break-words">{error}</p>
              <button
                onClick={handleAnalyze}
                className="text-xs mt-2 px-2 py-1 bg-red-100 hover:bg-red-200 rounded text-red-700 font-medium transition-colors"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {analysis && expanded && (
        <div className="border-t border-primary-200 px-4 py-4 space-y-4">
          {/* Fallback notice */}
          {analysis.isFallback && (
            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <Cpu className="w-3.5 h-3.5 flex-shrink-0" />
              <span>
                <strong>Local analysis</strong> — Mistral API rate limit reached; this analysis was generated from the data directly (no AI call).
              </span>
            </div>
          )}
          {!analysis.isFallback && (
            <div className="flex items-center gap-2 text-xs text-primary-700 bg-primary-50 border border-primary-200 rounded-lg px-3 py-2">
              <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Powered by <strong>Mistral AI</strong> · Based on NISR agricultural data</span>
            </div>
          )}

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
                    <span className="text-green-500 mt-0.5 flex-shrink-0">•</span>
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
                    <span className="text-amber-500 mt-0.5 flex-shrink-0">•</span>
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
                    <span className="text-blue-500 mt-0.5 flex-shrink-0 font-medium">{i + 1}.</span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
