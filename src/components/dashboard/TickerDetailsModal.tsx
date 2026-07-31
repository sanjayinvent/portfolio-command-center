import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useDatabase } from '../../hooks/useDatabase';
import { Holding, fmt, fmtDec } from '../../lib/types';

interface TickerDetailsModalProps {
  holding: Holding;
  onClose: () => void;
}

export function TickerDetailsModal({ holding, onClose }: TickerDetailsModalProps) {
  const { getApiConfig } = useDatabase();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Schwab Option Chain State
  const [schwabConnected, setSchwabConnected] = useState(false);
  const [optionChain, setOptionChain] = useState<any[]>([]);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const schwabConfig = await getApiConfig('schwab');
        if (schwabConfig && schwabConfig.oauth_token) {
          setSchwabConnected(true);
          try {
            const chain: any = await invoke('fetch_schwab_option_chain', {
              ticker: holding.ticker,
              accessToken: schwabConfig.oauth_token
            });
            
            // Basic parsing of Schwab's Option Chain response (calls only for covered calls)
            if (chain.callExpDateMap) {
              const optionsData: any[] = [];
              Object.keys(chain.callExpDateMap).forEach(expDate => {
                const strikes = chain.callExpDateMap[expDate];
                Object.keys(strikes).forEach(strike => {
                  const contractInfo = strikes[strike][0];
                  optionsData.push({
                    strike: parseFloat(strike),
                    daysToExpiration: contractInfo.daysToExpiration,
                    bid: contractInfo.bid,
                    ask: contractInfo.ask,
                    delta: contractInfo.delta,
                    theta: contractInfo.theta,
                    volume: contractInfo.totalVolume
                  });
                });
              });
              
              // Filter to roughly 30-45 DTE
              const targetDte = optionsData.filter(o => o.daysToExpiration >= 28 && o.daysToExpiration <= 45);
              setOptionChain(targetDte);
            }
          } catch (e) {
            console.error("Schwab API fetch failed:", e);
            setError("Failed to fetch live Option Chain from Schwab API.");
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchOptions();
  }, [holding.ticker, getApiConfig]);

  const currPrice = holding.current_price || 0;
  
  // Calculate Target Strikes mathematically
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
            <div className="text-2xl font-bold">{fmt.format(holding.avg_cost_basis)}</div>
          </div>
          <div>
            <div className="text-sm text-muted">Next Earnings</div>
            <div className="text-xl font-bold text-blue">TBD</div>
            <div className="text-xs text-muted">Requires Schwab Calendar</div>
          </div>
        </div>

        <div className="panel mt-4">
          <div className="panel-header mb-2">
            <span>30-45 Days to Expiration (DTE) Target Strikes</span>
          </div>
          <p className="text-sm text-muted mb-4">
            {schwabConnected 
              ? "Live option chain data fetched from Charles Schwab API." 
              : "Charles Schwab API not connected. Displaying mathematically calculated strike targets based on current live price. Connect Schwab in Settings to see live Bid/Ask premiums and Greeks."}
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
                  
                  // If we have schwab data, find the closest strike that is >= the calculated target
                  let closestStrike: any = null;
                  if (optionChain.length > 0) {
                    closestStrike = optionChain.reduce((prev, curr) => {
                      // We only want strikes above the target
                      if (curr.strike < calculatedTarget) return prev;
                      if (!prev) return curr;
                      return (curr.strike - calculatedTarget < prev.strike - calculatedTarget) ? curr : prev;
                    }, null);
                  }

                  return (
                    <tr key={t.label}>
                      <td className="font-bold">{t.label}</td>
                      <td>{fmt.format(calculatedTarget)}</td>
                      
                      {schwabConnected && closestStrike ? (
                        <>
                          <td className="font-bold text-blue">{fmt.format(closestStrike.strike)} ({closestStrike.daysToExpiration} DTE)</td>
                          <td className="text-right text-green">{fmtDec.format(closestStrike.bid)} / {fmtDec.format(closestStrike.ask)}</td>
                          <td className="text-right text-muted">{closestStrike.delta}</td>
                          <td className="text-right text-muted">{closestStrike.theta}</td>
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
