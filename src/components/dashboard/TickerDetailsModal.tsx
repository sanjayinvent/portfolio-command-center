import { useState, useEffect } from 'react';
import { useApi } from '../../hooks/useApi';
import { apiClient } from '../../services/apiClient';
import { Holding, fmt, fmtDec } from '../../lib/types';

interface TickerDetailsModalProps {
  holding: Holding;
  onClose: () => void;
}

export function TickerDetailsModal({ holding, onClose }: TickerDetailsModalProps) {
  const { getApiConfig } = useApi();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [schwabConnected, setSchwabConnected] = useState(false);
  const [optionChain, setOptionChain] = useState<any[]>([]);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const config = await getApiConfig('schwab');
        if (config && config.is_active) {
          setSchwabConnected(true);
        }
        
        // Fetch strategy simulation & options from Python backend
        try {
          const simData: any = await apiClient.simulateStrategy({
            ticker: holding.ticker,
            cost_basis: holding.avg_cost_basis || holding.cost_basis || 100,
            shares: holding.shares || 100
          });
          if (simData && simData.options) {
            setOptionChain(simData.options);
          }
        } catch (e) {
          console.error("Backend strategy simulate failed:", e);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchOptions();
  }, [holding.ticker]);

  const currPrice = holding.current_price || holding.market_price || 0;
  
  const targets = [
    { label: "5% OTM", pct: 1.05 },
    { label: "10% OTM", pct: 1.10 },
    { label: "15% OTM", pct: 1.15 },
    { label: "20% OTM", pct: 1.20 }
  ];

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ width: '800px', maxWidth: '95vw' }}>
        <div className="modal-header">
          <h2>{holding.ticker} Analytics <span className="badge badge-blue ml-2">Options Planner</span></h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="grid-split mt-2">
          <div>
            <div className="text-sm text-muted">Current Price</div>
            <div className="text-2xl font-bold">{fmt.format(currPrice)}</div>
          </div>
          <div>
            <div className="text-sm text-muted">Shares Owned</div>
            <div className="text-2xl font-bold">{holding.shares.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-sm text-muted">Cost Basis</div>
            <div className="text-2xl font-bold">{fmt.format(holding.avg_cost_basis || holding.cost_basis || 0)}</div>
          </div>
          <div>
            <div className="text-sm text-muted">Next Earnings</div>
            <div className="text-xl font-bold text-blue">TBD</div>
            <div className="text-xs text-muted">Python Option Engine</div>
          </div>
        </div>

        <div className="panel mt-4">
          <div className="panel-header mb-2">
            <span>30-45 Days to Expiration (DTE) Target Strikes</span>
          </div>
          <p className="text-sm text-muted mb-4">
            {schwabConnected 
              ? "Live option chain data fetched from API." 
              : "Displaying calculated strike targets powered by Python FastAPI options engine."}
          </p>

          {error && <div className="text-red text-sm mb-4">{error}</div>}

          {loading ? (
            <div className="p-4 text-center text-muted">Loading options data...</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Target</th>
                  <th>Calculated Price</th>
                  <th>Closest Strike (Live)</th>
                  <th className="text-right">Bid/Ask (Live)</th>
                  <th className="text-right">Delta</th>
                  <th className="text-right">Theta</th>
                </tr>
              </thead>
              <tbody>
                {targets.map(t => {
                  const calculatedTarget = currPrice * t.pct;
                  let closestStrike: any = null;
                  if (optionChain.length > 0) {
                    closestStrike = optionChain.reduce((prev, curr) => {
                      if (curr.strike < calculatedTarget) return prev;
                      if (!prev) return curr;
                      return (curr.strike - calculatedTarget < prev.strike - calculatedTarget) ? curr : prev;
                    }, null);
                  }

                  return (
                    <tr key={t.label}>
                      <td className="font-bold">{t.label}</td>
                      <td>{fmt.format(calculatedTarget)}</td>
                      
                      {closestStrike ? (
                        <>
                          <td className="font-bold text-blue">{fmt.format(closestStrike.strike)} ({closestStrike.daysToExpiration || 30} DTE)</td>
                          <td className="text-right text-green">{fmtDec.format(closestStrike.bid || 0)} / {fmtDec.format(closestStrike.ask || 0)}</td>
                          <td className="text-right text-muted">{closestStrike.delta || '--'}</td>
                          <td className="text-right text-muted">{closestStrike.theta || '--'}</td>
                        </>
                      ) : (
                        <>
                          <td className="text-muted text-sm">--</td>
                          <td className="text-right text-muted text-sm">--</td>
                          <td className="text-right text-muted text-sm">--</td>
                          <td className="text-right text-muted text-sm">--</td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
