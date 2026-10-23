import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import AgriMap from './pages/AgriMap';
import CropComparison from './pages/CropComparison';
import Insights from './pages/Insights';
import Solutions from './pages/Solutions';
import CashCrops from './pages/CashCrops';
import Reports from './pages/Reports';
import { initNisrConnection, getApiError } from './services/nisr';
import { ThemeProvider } from './context/ThemeContext';
import { RefreshCw, WifiOff } from 'lucide-react';

type LoadState = 'loading' | 'ready' | 'error';

function AppContent() {
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [retrying, setRetrying] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const connect = async (isRetry = false) => {
    if (isRetry) setRetrying(true);
    else setLoadState('loading');
    setApiError(null);

    const ok = await initNisrConnection();

    if (ok) {
      setLoadState('ready');
    } else {
      setApiError(getApiError());
      setLoadState('error');
    }
    setRetrying(false);
  };

  useEffect(() => { void connect(); }, []);

  // ── Loading ──
  if (loadState === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        <div className="text-center">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Loading NISR data…</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Connecting to pxweb.statistics.gov.rw</p>
        </div>
      </div>
    );
  }

  // ── Error — API unavailable ──
  if (loadState === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-8 max-w-md w-full text-center">
          <div className="w-14 h-14 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <WifiOff className="w-7 h-7 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
            NISR Data Unavailable
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-2 leading-relaxed">
            Could not connect to the NISR PXWeb API. No production data is available.
          </p>
          {apiError && (
            <p className="text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2 mb-5 font-mono break-all">
              {apiError}
            </p>
          )}
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-6">
            This app displays live data from the National Institute of Statistics of Rwanda only.
            No sample or estimated data is shown.
          </p>
          <button
            onClick={() => connect(true)}
            disabled={retrying}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} />
            {retrying ? 'Retrying…' : 'Retry Connection'}
          </button>
        </div>
      </div>
    );
  }

  // ── Ready ──
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/map" element={<AgriMap />} />
          <Route path="/comparison" element={<CropComparison />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/solutions" element={<Solutions />} />
          <Route path="/cash-crops" element={<CashCrops />} />
          <Route path="/reports" element={<Reports />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
