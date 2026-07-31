import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { runSimulation, SimulationSnapshot } from '../../lib/simulation';
import { fmt, fmtDec } from '../../lib/types';

export function SimulationManager() {
  const { getHoldings } = useApi();
  const [snapshots, setSnapshots] = useState<SimulationSnapshot[]>([]);
  const [loading, setLoading] = useState(false);

  const handleRunSimulation = async () => {
    setLoading(true);
    try {
      const currentHoldings = await getHoldings();
      if (currentHoldings.length === 0) {
        alert("No holdings found. Please seed the database first from the Dashboard.");
        setLoading(false);
        return;
      }
      const results = runSimulation(currentHoldings);
      setSnapshots(results);
    } catch (e) {
      console.error(e);
      alert("Simulation failed to run.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Simulation Engine</h1>
          <p className="subtitle">60-Month Portfolio Transition & Growth Model</p>
        </div>
        <div>
          <button className="btn" onClick={handleRunSimulation} disabled={loading}>
            {loading ? 'Running...' : '▶ Run 60-Month Simulation'}
          </button>
        </div>
      </div>

      {snapshots.length === 0 ? (
        <div className="panel mt-4 p-8 text-center text-muted">
          <p>Click "Run 60-Month Simulation" to generate the projection based on your current holdings.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 mt-4">
          <div className="panel">
            <div className="panel-header">
              <span>Final Snapshot (Month 60)</span>
            </div>
            <div className="kpi-row mt-2" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
              <div className="kpi-chip">
                <span className="kpi-label">Total Value</span>
                <span className="kpi-value text-green">{fmt.format(snapshots[60].totalVal)}</span>
              </div>
              <div className="kpi-chip">
                <span className="kpi-label">Stock Value</span>
                <span className="kpi-value">{fmt.format(snapshots[60].stockVal)}</span>
                <span className="kpi-sub">{snapshots[60].stockPct.toFixed(1)}%</span>
              </div>
              <div className="kpi-chip">
                <span className="kpi-label">ETF Value</span>
                <span className="kpi-value">{fmt.format(snapshots[60].etfVal)}</span>
                <span className="kpi-sub">{snapshots[60].etfPct.toFixed(1)}%</span>
              </div>
              <div className="kpi-chip">
                <span className="kpi-label">Final Monthly Sweep</span>
                <span className="kpi-value text-blue">{fmt.format(snapshots[60].monthlySweep)}</span>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header mb-2">
              <span>Timeline Log</span>
            </div>
            <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
              {snapshots.map(snap => (
                <div key={snap.monthIndex} className="timeline-card mb-2" style={{ padding: '12px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--panel-bg)' }}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-blue">{snap.dateLabel}</span>
                    <span className="badge badge-purple">{snap.phaseBadge}</span>
                  </div>
                  <p className="text-sm text-muted mb-2">{snap.phaseDesc}</p>
                  
                  <div className="grid-split text-sm">
                    <div>
                      <div><strong>Total Val:</strong> {fmt.format(snap.totalVal)}</div>
                      <div><strong>Stocks:</strong> {fmt.format(snap.stockVal)} ({snap.stockPct.toFixed(1)}%)</div>
                      <div><strong>ETFs:</strong> {fmt.format(snap.etfVal)} ({snap.etfPct.toFixed(1)}%)</div>
                    </div>
                    <div>
                      <div><strong>Sweep Generated:</strong> {fmt.format(snap.monthlySweep)}</div>
                      <div className="text-muted">Opt: {fmt.format(snap.singleStockOptIncome + snap.etfOptIncome)} | Div: {fmt.format(snap.divIncome)} | Cash: $5,000</div>
                      <div className="text-red"><strong>Tax Reserve:</strong> {fmt.format(snap.monthlyTaxEst)}</div>
                    </div>
                  </div>
                  
                  {snap.trades.length > 0 && (
                    <div className="mt-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                      <span className="text-xs font-bold text-muted">EXECUTED TRADES:</span>
                      <div className="text-xs font-mono mt-1">
                        {snap.trades.map((t, i) => (
                          <div key={i} className={t.action === 'BUY' ? 'text-green' : 'text-red'}>
                            {t.action} {t.ticker}: {t.shares.toFixed(2)} sh @ {fmtDec.format(t.price)} = {fmt.format(t.val)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
