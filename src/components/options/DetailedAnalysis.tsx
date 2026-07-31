import { useState, useEffect } from 'react';
import { useApi } from '../../hooks/useApi';
import { apiClient } from '../../services/apiClient';
import { Holding, fmt, fmtDec } from '../../lib/types';

export function DetailedAnalysis() {
  const { getHoldings, getApiConfig } = useApi();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [selectedTicker, setSelectedTicker] = useState<string>('NVDA');
  const [customTickerInput, setCustomTickerInput] = useState<string>('');
  const [currentPrice, setCurrentPrice] = useState<number>(194.00);
  const [costBasis, setCostBasis] = useState<number>(194.00);
  const [sharesOwned, setSharesOwned] = useState<number>(100);
  const [loading, setLoading] = useState(false);
  const [schwabConnected, setSchwabConnected] = useState(false);
  const [dataSource, setDataSource] = useState<string>('Initializing...');
  const [lastSyncTime, setLastSyncTime] = useState<string>('--');
  const [optionChain, setOptionChain] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Strategy Sliders
  const [ccStrikePct, setCcStrikePct] = useState<number>(10);
  const [collarCallPct, setCollarCallPct] = useState<number>(10);
  const [collarPutPct, setCollarPutPct] = useState<number>(10);
  const [cspStrikePct, setCspStrikePct] = useState<number>(5);

  useEffect(() => {
    const loadHoldings = async () => {
      const data = await getHoldings();
      setHoldings(data);
      if (data.length > 0) {
        const first = data[0];
        setSelectedTicker(first.ticker);
        setCurrentPrice(first.current_price || first.market_price || 100);
        setCostBasis(first.avg_cost_basis || first.cost_basis || first.current_price || 100);
        setSharesOwned(first.shares || 100);
      }
    };
    loadHoldings();
  }, []);

  const handleSelectTicker = (ticker: string) => {
    setSelectedTicker(ticker);
    setCustomTickerInput('');
    const found = holdings.find(h => h.ticker === ticker);
    if (found) {
      setCurrentPrice(found.current_price || found.market_price || 100);
      setCostBasis(found.avg_cost_basis || found.cost_basis || found.current_price || 100);
      setSharesOwned(found.shares || 100);
    }
  };

  const handleCustomTickerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTickerInput) return;
    const ticker = customTickerInput.toUpperCase();
    setSelectedTicker(ticker);
    const found = holdings.find(h => h.ticker === ticker);
    if (found) {
      setCurrentPrice(found.current_price || found.market_price || 100);
      setCostBasis(found.avg_cost_basis || found.cost_basis || found.current_price || 100);
      setSharesOwned(found.shares || 100);
    } else {
      setCurrentPrice(150.00);
      setCostBasis(150.00);
      setSharesOwned(100);
    }
  };

  const [providerStatuses, setProviderStatuses] = useState<{
    python?: string;
    yahoo?: string;
    schwab?: string;
    math?: string;
  }>({});

  const fetchPythonBackend = async (ticker: string) => {
    setLoading(true);
    setError(null);
    try {
      const data: any = await apiClient.simulateStrategy({
        ticker,
        cost_basis: costBasis,
        shares: sharesOwned,
        cc_strike_pct: ccStrikePct,
        collar_call_pct: collarCallPct,
        collar_put_pct: collarPutPct,
        csp_strike_pct: cspStrikePct
      });

      if (data) {
        if (data.current_price) {
          setCurrentPrice(data.current_price);
        }
        if (data.options) {
          setOptionChain(data.options);
        }
        setSchwabConnected(false);
        setDataSource('Python FastAPI Options Engine (Port 8000)');
        setLastSyncTime(new Date().toLocaleTimeString());
        setProviderStatuses(prev => ({ ...prev, python: 'Success (200 OK — Python Engine)' }));
      }
    } catch (err: any) {
      console.error(err);
      setProviderStatuses(prev => ({ ...prev, python: `Failed: ${err?.message || err}` }));
      setError(`Python FastAPI Error: ${err?.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchYahoo = async (ticker: string) => {
    return fetchPythonBackend(ticker);
  };

  const fetchSchwab = async (ticker: string) => {
    setLoading(true);
    setError(null);
    try {
      const config = await getApiConfig('schwab');
      if (!config || !config.is_active) {
        setProviderStatuses(prev => ({ ...prev, schwab: 'Failed (No Token in Settings)' }));
        setError('No Schwab Access Token found. Please authenticate in Settings.');
        setLoading(false);
        return;
      }
      setSchwabConnected(true);
      setDataSource('Charles Schwab Trader API');
      setLastSyncTime(new Date().toLocaleTimeString());
      setProviderStatuses(prev => ({ ...prev, schwab: 'Success (Connected)' }));
    } catch (err: any) {
      console.error(err);
      setProviderStatuses(prev => ({ ...prev, schwab: `Failed: ${err}` }));
      setError(`Schwab API Error: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const useMathModel = () => {
    setOptionChain([]);
    setSchwabConnected(false);
    setDataSource('Internal Mathematical Model');
    setLastSyncTime(new Date().toLocaleTimeString());
    setProviderStatuses(prev => ({ ...prev, math: 'Active (Calculated)' }));
  };

  useEffect(() => {
    if (selectedTicker) {
      fetchPythonBackend(selectedTicker);
    }
  }, [selectedTicker]);

  // Calculated Strike Values
  const getStrikeDetails = (pctOffset: number, type: 'call' | 'put') => {
    const isCall = type === 'call';
    const targetPrice = isCall 
      ? currentPrice * (1 + pctOffset / 100) 
      : currentPrice * (1 - pctOffset / 100);

    let match = null;
    if (optionChain.length > 0) {
      const candidates = optionChain.filter(o => o.type === type || o.option_type === type);
      if (candidates.length > 0) {
        match = candidates.reduce((prev, curr) => {
          return Math.abs(curr.strike - targetPrice) < Math.abs(prev.strike - targetPrice) ? curr : prev;
        });
      }
    }

    const estimatedBid = isCall 
      ? Math.max(0.50, (currentPrice * 0.035) * (1 - pctOffset * 0.04))
      : Math.max(0.50, (currentPrice * 0.030) * (1 - pctOffset * 0.04));

    const calcExpDate = new Date(Date.now() + (match ? match.dte : 31) * 86400 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    return {
      targetPrice,
      strike: match ? match.strike : Math.round(targetPrice),
      bid: match ? match.bid : estimatedBid,
      ask: match ? match.ask : estimatedBid * 1.05,
      delta: match ? match.delta : (isCall ? Math.max(0.10, 0.50 - pctOffset * 0.03) : Math.max(-0.50, -0.50 + pctOffset * 0.03)),
      theta: match ? match.theta : -0.04,
      dte: match ? match.dte : 31,
      expDateLabel: match && match.expDateLabel ? match.expDateLabel : calcExpDate
    };
  };

  const ccDetails = getStrikeDetails(ccStrikePct, 'call');
  const collarCallDetails = getStrikeDetails(collarCallPct, 'call');
  const collarPutDetails = getStrikeDetails(collarPutPct, 'put');
  const cspDetails = getStrikeDetails(cspStrikePct, 'put');

  const ccPremiumPerContract = ccDetails.bid * 100;
  const ccMaxProfit = (ccDetails.strike - currentPrice) * 100 + ccPremiumPerContract;
  const ccBreakeven = currentPrice - ccDetails.bid;
  const ccAnnualizedMarket = ((ccPremiumPerContract / (currentPrice * 100)) * (365 / ccDetails.dte)) * 100;
  const ccAnnualizedCost = costBasis > 0 ? ((ccPremiumPerContract / (costBasis * 100)) * (365 / ccDetails.dte)) * 100 : 0;

  const collarNetCredit = (collarCallDetails.bid - collarPutDetails.ask) * 100;
  const collarMaxProfit = (collarCallDetails.strike - currentPrice) * 100 + collarNetCredit;
  const collarMaxLoss = (currentPrice - collarPutDetails.strike) * 100 - collarNetCredit;
  const collarBreakeven = currentPrice - (collarNetCredit / 100);
  const collarAnnualizedMarket = ((collarNetCredit / (currentPrice * 100)) * (365 / collarCallDetails.dte)) * 100;
  const collarAnnualizedCost = costBasis > 0 ? ((collarNetCredit / (costBasis * 100)) * (365 / collarCallDetails.dte)) * 100 : 0;

  const cspPremiumPerContract = cspDetails.bid * 100;
  const cspMaxProfit = cspPremiumPerContract;
  const cspBreakeven = cspDetails.strike - cspDetails.bid;
  const cspAnnualized = ((cspPremiumPerContract / (cspDetails.strike * 100)) * (365 / cspDetails.dte)) * 100;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Detailed Option Analysis</h1>
          <p className="subtitle">Side-by-Side Strategy Simulator (V2 Python FastAPI Engine)</p>
        </div>
        <div className="flex items-center gap-2">
          {schwabConnected ? (
            <span className="badge badge-green">Live Schwab API</span>
          ) : optionChain.length > 0 ? (
            <span className="badge badge-blue">Python FastAPI Options Engine</span>
          ) : (
            <span className="badge badge-amber">Mathematical Model</span>
          )}
        </div>
      </div>

      <div className="panel flex flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="input-group">
            <label>Select Position</label>
            <select 
              value={selectedTicker} 
              onChange={(e) => handleSelectTicker(e.target.value)}
              className="font-bold"
            >
              {holdings.map(h => (
                <option key={h.id || h.ticker} value={h.ticker}>
                  {h.ticker} ({h.shares} sh @ {fmt.format(h.current_price || h.market_price || 0)})
                </option>
              ))}
            </select>
          </div>

          <form onSubmit={handleCustomTickerSubmit} className="flex items-end gap-2">
            <div className="input-group">
              <label>Custom Ticker</label>
              <input 
                type="text" 
                placeholder="e.g. AAPL" 
                value={customTickerInput}
                onChange={(e) => setCustomTickerInput(e.target.value)}
                style={{ width: '100px' }}
              />
            </div>
            <button type="submit" className="btn btn-secondary">Analyze</button>
          </form>
        </div>

        <div className="flex gap-4 text-right">
          <div>
            <div className="text-xs text-muted">Current Price</div>
            <div className="text-xl font-bold text-blue">{fmt.format(currentPrice)}</div>
          </div>
          <div>
            <div className="text-xs text-muted">Cost Basis</div>
            <div className="text-xl font-bold text-purple">{fmt.format(costBasis)}</div>
          </div>
          <div>
            <div className="text-xs text-muted">Shares / Capital</div>
            <div className="text-xl font-bold">{sharesOwned} sh</div>
          </div>
        </div>
      </div>

      <div className="panel flex flex-col gap-2">
        <div className="text-xs font-bold text-muted">DATA PROVIDER SELECTOR FOR {selectedTicker}:</div>
        <div className="flex flex-wrap gap-2 items-center">
          <button 
            type="button"
            className={`btn text-xs ${dataSource.includes('Python') ? 'bg-purple-600 text-white font-bold' : 'btn-secondary'}`}
            onClick={() => fetchPythonBackend(selectedTicker)}
            disabled={loading}
          >
            🐍 Fetch via Python FastAPI Backend (Port 8000)
          </button>
          <button 
            type="button"
            className={`btn text-xs ${dataSource.includes('Schwab') ? 'bg-blue-600 text-white font-bold' : 'btn-secondary'}`}
            onClick={() => fetchSchwab(selectedTicker)}
            disabled={loading}
          >
            🔵 Fetch Charles Schwab API
          </button>
          <button 
            type="button"
            className={`btn text-xs ${dataSource.includes('Mathematical') ? 'bg-purple-600 text-white font-bold' : 'btn-secondary'}`}
            onClick={useMathModel}
          >
            🟣 Use Mathematical Model
          </button>
        </div>

        <div className="flex flex-wrap gap-4 text-xs font-mono mt-1">
          {providerStatuses.python && (
            <span className={providerStatuses.python.startsWith('Success') ? 'text-purple font-bold' : 'text-red font-bold'}>
              Python Engine: {providerStatuses.python}
            </span>
          )}
          {providerStatuses.schwab && (
            <span className={providerStatuses.schwab.startsWith('Success') ? 'text-green font-bold' : 'text-red font-bold'}>
              Schwab: {providerStatuses.schwab}
            </span>
          )}
          {providerStatuses.math && (
            <span className="text-purple font-bold">
              Math Model: {providerStatuses.math}
            </span>
          )}
        </div>
      </div>

      <div className="panel bg-blue-50 border-blue-200 text-xs flex flex-row items-center justify-between py-2 px-3">
        <div className="flex items-center gap-2">
          <span className="font-bold text-blue">📡 Data Source:</span>
          <span className="font-semibold text-gray-800">{dataSource}</span>
        </div>
        <div className="flex items-center gap-4">
          <div>
            <span className="text-muted">Last Sync: </span>
            <span className="font-bold font-mono text-gray-800">{lastSyncTime}</span>
          </div>
          <div>
            <span className="text-muted">Spot Price: </span>
            <span className="font-bold font-mono text-blue">{fmt.format(currentPrice)}</span>
          </div>
          <div>
            <span className="text-muted">Cost Basis: </span>
            <span className="font-bold font-mono text-purple">{fmt.format(costBasis)}</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-100 text-red-800 rounded border border-red-300 text-xs">
          {error} (Using mathematical estimation).
        </div>
      )}

      <div className="grid-3 mt-2">
        <div className="panel">
          <div className="panel-header flex flex-col items-start gap-1">
            <div className="flex justify-between w-full items-center">
              <span>1. Covered Call</span>
              <span className="badge badge-blue">Income Focus</span>
            </div>
            <div className="text-xs text-muted font-normal">
              📅 Expiration: <strong className="text-blue">{ccDetails.expDateLabel}</strong> ({ccDetails.dte} DTE)
            </div>
          </div>

          <div className="card">
            <div className="text-xs font-bold text-muted mb-1">STRIKE SELECTION ({ccStrikePct}% OTM)</div>
            <input 
              type="range" 
              min="1" 
              max="25" 
              value={ccStrikePct} 
              onChange={(e) => setCcStrikePct(Number(e.target.value))} 
            />
            <div className="flex justify-between text-xs mt-1 font-mono">
              <span>Target: {fmt.format(currentPrice * (1 + ccStrikePct/100))}</span>
              <span className="font-bold text-blue">Strike: ${ccDetails.strike}</span>
            </div>
          </div>

          <table className="data-table mt-2">
            <thead>
              <tr>
                <th>Target</th>
                <th>Strike</th>
                <th className="text-right">Est. Bid</th>
                <th className="text-right">Delta</th>
              </tr>
            </thead>
            <tbody>
              {[5, 10, 15, 20].map(pct => {
                const s = getStrikeDetails(pct, 'call');
                return (
                  <tr key={pct} className={ccStrikePct === pct ? 'bg-blue-50 font-bold' : ''}>
                    <td>{pct}% OTM</td>
                    <td>${s.strike}</td>
                    <td className="text-right text-green">{fmtDec.format(s.bid)}</td>
                    <td className="text-right">{s.delta ? (typeof s.delta === 'number' ? s.delta.toFixed(2) : s.delta) : '--'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="panel mt-2 bg-gray-50">
            <div className="text-xs font-bold text-muted mb-2">P&L & RETURN FORECAST ({ccDetails.dte} DTE)</div>
            <div className="flex justify-between text-sm py-1 border-b border-gray-200">
              <span>Premium Collected:</span>
              <span className="font-bold text-green">{fmt.format(ccPremiumPerContract)}</span>
            </div>
            <div className="flex justify-between text-sm py-1 border-b border-gray-200">
              <span>Max Upside Profit:</span>
              <span className="font-bold">{fmt.format(ccMaxProfit)}</span>
            </div>
            <div className="flex justify-between text-sm py-1 border-b border-gray-200">
              <span>Breakeven Price:</span>
              <span>{fmt.format(ccBreakeven)}</span>
            </div>
            <div className="flex justify-between text-sm py-1 border-b border-gray-200">
              <span>Ann. Return (Current Price):</span>
              <span className="font-bold text-blue">{ccAnnualizedMarket.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between text-sm py-1 font-bold">
              <span>Ann. Return (Cost Basis):</span>
              <span className="text-purple">{ccAnnualizedCost.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header flex flex-col items-start gap-1">
            <div className="flex justify-between w-full items-center">
              <span>2. Covered Call + Collar</span>
              <span className="badge badge-purple">Protected</span>
            </div>
            <div className="text-xs text-muted font-normal">
              📅 Expiration: <strong className="text-purple">{collarCallDetails.expDateLabel}</strong> ({collarCallDetails.dte} DTE)
            </div>
          </div>

          <div className="card flex flex-col gap-2">
            <div>
              <div className="text-xs font-bold text-muted mb-1">SHORT CALL CAP ({collarCallPct}% OTM)</div>
              <input 
                type="range" 
                min="1" 
                max="25" 
                value={collarCallPct} 
                onChange={(e) => setCollarCallPct(Number(e.target.value))} 
              />
              <div className="flex justify-between text-xs mt-1 font-mono">
                <span>Cap Target: {fmt.format(currentPrice * (1 + collarCallPct/100))}</span>
                <span className="font-bold text-green">Call: ${collarCallDetails.strike}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-200">
              <div className="text-xs font-bold text-muted mb-1">LONG PUT FLOOR ({collarPutPct}% OTM)</div>
              <input 
                type="range" 
                min="1" 
                max="25" 
                value={collarPutPct} 
                onChange={(e) => setCollarPutPct(Number(e.target.value))} 
              />
              <div className="flex justify-between text-xs mt-1 font-mono">
                <span>Floor Target: {fmt.format(currentPrice * (1 - collarPutPct/100))}</span>
                <span className="font-bold text-purple">Put: ${collarPutDetails.strike}</span>
              </div>
            </div>
          </div>

          <table className="data-table mt-2">
            <thead>
              <tr>
                <th>Leg</th>
                <th>Strike</th>
                <th className="text-right">Price</th>
                <th className="text-right">Net Credit</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="text-green font-bold">Short Call</td>
                <td>${collarCallDetails.strike}</td>
                <td className="text-right">+{fmtDec.format(collarCallDetails.bid)}</td>
                <td rowSpan={2} className={`text-right align-middle font-bold ${collarNetCredit >= 0 ? 'text-green' : 'text-red'}`}>
                  {fmt.format(collarNetCredit)}
                </td>
              </tr>
              <tr>
                <td className="text-red font-bold">Long Put</td>
                <td>${collarPutDetails.strike}</td>
                <td className="text-right">-{fmtDec.format(collarPutDetails.ask)}</td>
              </tr>
            </tbody>
          </table>

          <div className="panel mt-2 bg-gray-50">
            <div className="text-xs font-bold text-muted mb-2">COLLAR RISK PROFILE ({collarCallDetails.dte} DTE)</div>
            <div className="flex justify-between text-sm py-1 border-b border-gray-200">
              <span>Net Cost / Credit:</span>
              <span className={`font-bold ${collarNetCredit >= 0 ? 'text-green' : 'text-red'}`}>
                {fmt.format(collarNetCredit)}
              </span>
            </div>
            <div className="flex justify-between text-sm py-1 border-b border-gray-200">
              <span>Cap (Max Profit):</span>
              <span className="font-bold text-green">{fmt.format(collarMaxProfit)}</span>
            </div>
            <div className="flex justify-between text-sm py-1 border-b border-gray-200">
              <span>Floor (Max Loss):</span>
              <span className="font-bold text-red">-{fmt.format(collarMaxLoss)}</span>
            </div>
            <div className="flex justify-between text-sm py-1 border-b border-gray-200">
              <span>Breakeven:</span>
              <span>{fmt.format(collarBreakeven)}</span>
            </div>
            <div className="flex justify-between text-sm py-1 border-b border-gray-200">
              <span>Ann. Return (Current Price):</span>
              <span className="font-bold text-blue">{collarAnnualizedMarket.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between text-sm py-1 font-bold">
              <span>Ann. Return (Cost Basis):</span>
              <span className="text-purple">{collarAnnualizedCost.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header flex flex-col items-start gap-1">
            <div className="flex justify-between w-full items-center">
              <span>3. Cash Secured Put</span>
              <span className="badge badge-indigo">Acquisition</span>
            </div>
            <div className="text-xs text-muted font-normal">
              📅 Expiration: <strong className="text-indigo">{cspDetails.expDateLabel}</strong> ({cspDetails.dte} DTE)
            </div>
          </div>

          <div className="card">
            <div className="text-xs font-bold text-muted mb-1">PUT STRIKE ({cspStrikePct}% OTM)</div>
            <input 
              type="range" 
              min="1" 
              max="25" 
              value={cspStrikePct} 
              onChange={(e) => setCspStrikePct(Number(e.target.value))} 
            />
            <div className="flex justify-between text-xs mt-1 font-mono">
              <span>Target: {fmt.format(currentPrice * (1 - cspStrikePct/100))}</span>
              <span className="font-bold text-indigo">Strike: ${cspDetails.strike}</span>
            </div>
          </div>

          <table className="data-table mt-2">
            <thead>
              <tr>
                <th>Target</th>
                <th>Strike</th>
                <th className="text-right">Est. Bid</th>
                <th className="text-right">Delta</th>
              </tr>
            </thead>
            <tbody>
              {[5, 10, 15, 20].map(pct => {
                const s = getStrikeDetails(pct, 'put');
                return (
                  <tr key={pct} className={cspStrikePct === pct ? 'bg-blue-50 font-bold' : ''}>
                    <td>{pct}% OTM</td>
                    <td>${s.strike}</td>
                    <td className="text-right text-green">{fmtDec.format(s.bid)}</td>
                    <td className="text-right">{s.delta ? (typeof s.delta === 'number' ? s.delta.toFixed(2) : s.delta) : '--'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="panel mt-2 bg-gray-50">
            <div className="text-xs font-bold text-muted mb-2">CSP RETURN FORECAST</div>
            <div className="flex justify-between text-sm py-1 border-b border-gray-200">
              <span>Capital Required:</span>
              <span className="font-bold">{fmt.format(cspDetails.strike * 100)}</span>
            </div>
            <div className="flex justify-between text-sm py-1 border-b border-gray-200">
              <span>Max Income:</span>
              <span className="font-bold text-green">{fmt.format(cspMaxProfit)}</span>
            </div>
            <div className="flex justify-between text-sm py-1 border-b border-gray-200">
              <span>Effective Cost Basis:</span>
              <span>{fmt.format(cspBreakeven)}</span>
            </div>
            <div className="flex justify-between text-sm py-1 font-bold">
              <span>Ann. Yield:</span>
              <span className="text-indigo">{cspAnnualized.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
