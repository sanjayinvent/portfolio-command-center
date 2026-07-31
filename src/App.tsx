import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { PageShell } from './components/layout/PageShell';
import { DashboardOverview } from './components/dashboard/DashboardOverview';
import { HoldingsManager } from './components/holdings/HoldingsManager';
import { SettingsManager } from './components/settings/SettingsManager';
import { SimulationManager } from './components/simulation/SimulationManager';
import { OptionsManager } from './components/options/OptionsManager';
import { CashFlowManager } from './components/cashflow/CashFlowManager';
import { DetailedAnalysis } from './components/options/DetailedAnalysis';

function App() {
  return (
    <Router>
      <PageShell>
        <Routes>
          <Route path="/" element={<DashboardOverview />} />
          <Route path="/holdings" element={<HoldingsManager />} />
          <Route path="/options" element={<OptionsManager />} />
          <Route path="/detailed-analysis" element={<DetailedAnalysis />} />
          <Route path="/simulation" element={<SimulationManager />} />
          <Route path="/cashflow" element={<CashFlowManager />} />
          <Route path="/settings" element={<SettingsManager />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </PageShell>
    </Router>
  );
}

export default App;
