import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import AgriMap from './pages/AgriMap';
import CropComparison from './pages/CropComparison';
import Insights from './pages/Insights';
import Reports from './pages/Reports';
import { initNisrConnection } from './services/nisr';

function App() {
  const [apiReady, setApiReady] = useState(false);

  useEffect(() => {
    initNisrConnection().finally(() => setApiReady(true));
  }, []);

  if (!apiReady) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        <p className="text-sm text-gray-500">Connecting to NISR data source…</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/map" element={<AgriMap />} />
          <Route path="/comparison" element={<CropComparison />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/reports" element={<Reports />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
