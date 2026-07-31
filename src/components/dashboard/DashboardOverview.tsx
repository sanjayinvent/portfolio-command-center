import React, { useState, useEffect } from 'react';
import { useApi } from '../../hooks/useApi';
import { Holding, OptionContract, fmt } from '../../lib/types';
import { runSimulation } from '../../lib/simulation';
import { TickerDetailsModal } from './TickerDetailsModal';

export function DashboardOverview() {
  const { addHolding, addOptionContract, getHoldings, getOptionContracts } = useApi();
  const [seeding, setSeeding] = useState(false);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [optionContracts, setOptionContracts] = useState<OptionContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [month1Trades, setMonth1Trades] = useState<any[]>([]);
  const [selectedHolding, setSelectedHolding] = useState<Holding | null>(null);
  
  const [viewMode, setViewMode] = useState<'nested' | 'separate'>('nested');

  const fetchDashboardData = async () => {
    try {
      const hData = await getHoldings();
      const oData = await getOptionContracts();
      setHoldings(hData);
      setOptionContracts(oData);
      
      if (hData.length > 0) {
        const sim = runSimulation(hData);
        if (sim.length > 1) {
          setMonth1Trades(sim[1].trades);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleSyncScreenshotData = async () => {
    setSeeding(true);
    try {
      const holdingsData = [
        { ticker: "AMZN", asset_type: "stock", shares: 150, current_price: 257.95, avg_cost_basis: 139.8395 },
        { ticker: "DRAM", asset_type: "stock", shares: 400, current_price: 53.60, avg_cost_basis: 54.28125, is_tax_loss_reserve: true, contracts_desc: "-4x 61.00 C 08/21" },
        { ticker: "NVDA", asset_type: "stock", shares: 200, current_price: 196.839, avg_cost_basis: 131.6529 },
        { ticker: "SMCI", asset_type: "stock", shares: 400, current_price: 28.40, avg_cost_basis: 31.45, is_tax_loss_reserve: true, contracts_desc: "-4x 29.00 C 08/28" },
        { ticker: "DIA", asset_type: "etf", shares: 80, current_price: 522.63, avg_cost_basis: 287.2784 },
        { ticker: "WM", asset_type: "stock", shares: 100, current_price: 226.77, avg_cost_basis: 131.2851 },
        { ticker: "SPY", asset_type: "etf", shares: 10, current_price: 743.43, avg_cost_basis: 413.841 },
        { ticker: "SGOV", asset_type: "etf", shares: 1900, current_price: 100.6885, avg_cost_basis: 100.5393 },
        { ticker: "JPM", asset_type: "stock", shares: 154, current_price: 350.80, avg_cost_basis: 97.066 },
        { ticker: "GLD", asset_type: "etf", shares: 33, current_price: 376.87, avg_cost_basis: 274.0058 },
        { ticker: "AEP", asset_type: "stock", shares: 300, current_price: 127.42, avg_cost_basis: 94.0404 },
        { ticker: "MSFT", asset_type: "stock", shares: 70, current_price: 448.47, avg_cost_basis: 338.4211 },
        { ticker: "NFLX", asset_type: "stock", shares: 400, current_price: 72.68, avg_cost_basis: 39.7725, contracts_desc: "-1x 73.00 C 08/21" }
      ];

      for (const h of holdingsData) {
        await addHolding(h);
      }

      const freshHoldings = await getHoldings();
      const dram = freshHoldings.find(h => h.ticker === 'DRAM');
      const smci = freshHoldings.find(h => h.ticker === 'SMCI');
      const nflx = freshHoldings.find(h => h.ticker === 'NFLX');

      if (dram) {
        await addOptionContract({
          holding_id: dram.id,
          symbol: 'DRAM',
          contract_type: 'call',
          strike_price: 61.00,
          expiration_date: '2026-08-21',
          contracts: -4,
          premium_received: 1.98,
          open_date: '2026-07-30'
        });
      }
      if (smci) {
        await addOptionContract({
          holding_id: smci.id,
          symbol: 'SMCI',
          contract_type: 'call',
          strike_price: 29.00,
          expiration_date: '2026-08-28',
          contracts: -4,
          premium_received: 2.78,
          open_date: '2026-07-30'
        });
      }
      if (nflx) {
        await addOptionContract({
          holding_id: nflx.id,
          symbol: 'NFLX',
          contract_type: 'call',
          strike_price: 73.00,
          expiration_date: '2026-08-21',
          contracts: -1,
          premium_received: 2.675,
          open_date: '2026-07-30'
        });
      }

      alert('Schwab Holdings & Option Contracts updated successfully!');
      fetchDashboardData();
    } catch (err) {
      console.error(err);
      alert('Error updating data: ' + err);
    } finally {
      setSeeding(false);
    }
  };

  const stockValue = holdings.filter(h => h.asset_type === 'stock').reduce((sum, h) => sum + h.shares * (h.current_price || h.market_price || 0), 0);
  const etfValue = holdings.filter(h => h.asset_type === 'etf').reduce((sum, h) => sum + h.shares * (h.current_price || h.market_price || 0), 0);
  const totalValue = stockValue + etfValue;
  
  const stockPct = totalValue > 0 ? (stockValue / totalValue) * 100 : 0;
  const etfPct = totalValue > 0 ? (etfValue / totalValue) * 100 : 0;

  if (loading) {
    return <div className="p-4">Loading dashboard...</div>;
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Dashboard Overview</h1>
          <p className="subtitle">Schwab Portfolio & Options Command Center (V2 Web Architecture)</p>
        </div>
        <div className="flex gap-2">
          <button className="btn" onClick={handleSyncScreenshotData} disabled={seeding}>
            {seeding ? 'Syncing...' : '🔄 Sync Schwab Screenshot Data'}
          </button>
        </div>
      </div>
      
      <div className="kpi-row">
        <div className="kpi-chip">
          <span className="kpi-label">Total Value</span>
          <span className="kpi-value">{fmt.format(totalValue)}</span>
          <span className="kpi-sub text-green">+34.09% Overall P&L</span>
        </div>
        <div className="kpi-chip">
          <span className="kpi-label">Stock Value</span>
          <span className="kpi-value">{fmt.format(stockValue)}</span>
          <span className="kpi-sub">{stockPct.toFixed(1)}%</span>
        </div>
        <div className="kpi-chip">
          <span className="kpi-label">ETF / Cash Value</span>
          <span className="kpi-value">{fmt.format(etfValue)}</span>
          <span className="kpi-sub">{etfPct.toFixed(1)}%</span>
        </div>
        <div className="kpi-chip">
          <span className="kpi-label">Monthly Sweep</span>
          <span className="kpi-value">{fmt.format(6250)}</span>
        </div>
      </div>

      <div className="grid-split mt-4">
        <div className="panel">
          <div className="panel-header">
            <span>Portfolio Allocation</span>
          </div>
          <div className="flex flex-col gap-2 mt-2 mb-2">
            <div className="flex justify-between items-center text-xs font-bold text-muted">
              <span>ETF & Fixed Income ({etfPct.toFixed(1)}%)</span>
              <span>Single Stocks ({stockPct.toFixed(1)}%)</span>
            </div>
            <div className="allocation-bar">
              <div className="segment-etf" style={{ width: `${etfPct}%` }}></div>
              <div className="segment-stock" style={{ width: `${stockPct}%` }}></div>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <span>Current Phase Plan (Month 1)</span>
          </div>
          <div className="phase-banner mt-2 flex justify-between">
            <div>
              <div className="font-bold">Phase 1: QQQ Sprint</div>
              <div className="text-xs text-muted mt-1">First Week Sweep Allocation:</div>
              {month1Trades.length > 0 ? (
                <div className="mt-2 flex flex-col gap-1 text-sm font-mono text-green">
                  {month1Trades.map((t, i) => (
                    <div key={i}>
                      ↳ BUY {t.shares.toFixed(2)} sh of {t.ticker} for {fmt.format(t.val)}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted mt-2">No trades projected.</div>
              )}
            </div>
            <span className="badge badge-blue">Months 1-4</span>
          </div>
        </div>
      </div>

      <div className="panel mt-4">
        <div className="panel-header mb-2 flex justify-between items-center">
          <span>Current Holdings & Covered Call Options</span>
          <div className="flex gap-2">
            <button 
              className={`btn btn-secondary text-xs ${viewMode === 'nested' ? 'bg-blue-100 text-blue font-bold border-blue' : ''}`}
              onClick={() => setViewMode('nested')}
            >
              📋 Nested View (Calls Under Stocks)
            </button>
            <button 
              className={`btn btn-secondary text-xs ${viewMode === 'separate' ? 'bg-blue-100 text-blue font-bold border-blue' : ''}`}
              onClick={() => setViewMode('separate')}
            >
              📊 Separate Tables View
            </button>
          </div>
        </div>

        {holdings.length === 0 ? (
          <p className="text-muted text-sm p-4">No holdings found. Click "Sync Schwab Screenshot Data" to populate your portfolio!</p>
        ) : viewMode === 'nested' ? (
          <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Symbol / Contract</th>
                  <th>Asset Type</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Price</th>
                  <th className="text-right">Cost Basis</th>
                  <th className="text-right">Mkt Value</th>
                  <th className="text-right">Gain / Loss</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map(h => {
                  const currPrice = h.current_price || h.market_price || 0;
                  const totalVal = h.shares * currPrice;
                  const costTotal = h.shares * (h.avg_cost_basis || h.cost_basis || 0);
                  const pnl = totalVal - costTotal;
                  const pnlPct = costTotal > 0 ? (pnl / costTotal) * 100 : 0;
                  const isPositive = pnl >= 0;

                  const attachedOptions = optionContracts.filter(o => o.holding_id === h.id);

                  return (
                    <React.Fragment key={h.id || h.ticker}>
                      <tr className="hover:bg-gray-50">
                        <td 
                          className="font-bold text-blue cursor-pointer hover:underline"
                          onClick={() => setSelectedHolding(h)}
                        >
                          {h.ticker}
                        </td>
                        <td className="text-xs text-muted">{h.asset_type.toUpperCase()}</td>
                        <td className="text-right font-mono">{h.shares}</td>
                        <td className="text-right font-mono">{fmt.format(currPrice)}</td>
                        <td className="text-right font-mono">{fmt.format(costTotal)}</td>
                        <td className="text-right font-bold font-mono">{fmt.format(totalVal)}</td>
                        <td className={`text-right font-mono ${isPositive ? 'text-green' : 'text-red'}`}>
                          {pnl > 0 ? '+' : ''}{fmt.format(pnl)} ({pnl > 0 ? '+' : ''}{pnlPct.toFixed(1)}%)
                        </td>
                      </tr>

                      {attachedOptions.map(opt => {
                        const optVal = (opt.contracts || opt.quantity || 1) * (opt.premium_received || opt.cost_basis || 0) * 100;
                        const strike = opt.strike_price || opt.strike || 0;
                        return (
                          <tr key={`opt-${opt.id || opt.symbol}`} className="bg-purple-50 text-xs">
                            <td className="pl-6 font-mono text-purple font-bold">
                              ↳ {h.ticker} {opt.expiration_date} {strike.toFixed(2)} C
                            </td>
                            <td className="text-xs text-purple font-semibold">COVERED CALL</td>
                            <td className="text-right font-mono text-purple font-bold">{opt.contracts || opt.quantity}</td>
                            <td className="text-right font-mono">${opt.premium_received || opt.cost_basis}</td>
                            <td className="text-right font-mono">--</td>
                            <td className="text-right font-mono font-bold text-purple">{fmt.format(optVal)}</td>
                            <td className="text-right font-mono text-green">+Protected</td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col gap-4" style={{ maxHeight: '600px', overflowY: 'auto' }}>
            <div>
              <div className="font-bold text-xs text-muted mb-1">SINGLE STOCKS</div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Price</th>
                    <th className="text-right">Cost Basis</th>
                    <th className="text-right">Mkt Value</th>
                    <th className="text-right">P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.filter(h => h.asset_type === 'stock').map(h => {
                    const currPrice = h.current_price || h.market_price || 0;
                    const totalVal = h.shares * currPrice;
                    const costTotal = h.shares * (h.avg_cost_basis || h.cost_basis || 0);
                    const pnl = totalVal - costTotal;
                    const isPos = pnl >= 0;
                    return (
                      <tr key={h.id || h.ticker}>
                        <td className="font-bold text-blue cursor-pointer" onClick={() => setSelectedHolding(h)}>{h.ticker}</td>
                        <td className="text-right">{h.shares}</td>
                        <td className="text-right">{fmt.format(currPrice)}</td>
                        <td className="text-right">{fmt.format(costTotal)}</td>
                        <td className="text-right font-bold">{fmt.format(totalVal)}</td>
                        <td className={`text-right ${isPos ? 'text-green' : 'text-red'}`}>{fmt.format(pnl)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div>
              <div className="font-bold text-xs text-muted mb-1">COVERED CALL OPTIONS CONTRACTS</div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Contract Symbol</th>
                    <th>Type</th>
                    <th className="text-right">Contracts</th>
                    <th className="text-right">Strike</th>
                    <th className="text-right">Exp Date</th>
                    <th className="text-right">Premium / Price</th>
                  </tr>
                </thead>
                <tbody>
                  {optionContracts.map(opt => {
                    const h = holdings.find(item => item.id === opt.holding_id);
                    const strike = opt.strike_price || opt.strike || 0;
                    return (
                      <tr key={opt.id || opt.symbol} className="bg-purple-50">
                        <td className="font-bold text-purple">{h ? h.ticker : opt.symbol} {opt.expiration_date} {strike} C</td>
                        <td>SHORT CALL</td>
                        <td className="text-right font-bold">{opt.contracts || opt.quantity}</td>
                        <td className="text-right">${strike}</td>
                        <td className="text-right">{opt.expiration_date}</td>
                        <td className="text-right font-bold">${opt.premium_received || opt.cost_basis}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div>
              <div className="font-bold text-xs text-muted mb-1">ETFS & CASH EQUIVALENTS</div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Price</th>
                    <th className="text-right">Cost Basis</th>
                    <th className="text-right">Mkt Value</th>
                    <th className="text-right">P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.filter(h => h.asset_type === 'etf').map(h => {
                    const currPrice = h.current_price || h.market_price || 0;
                    const totalVal = h.shares * currPrice;
                    const costTotal = h.shares * (h.avg_cost_basis || h.cost_basis || 0);
                    const pnl = totalVal - costTotal;
                    const isPos = pnl >= 0;
                    return (
                      <tr key={h.id || h.ticker}>
                        <td className="font-bold text-blue">{h.ticker}</td>
                        <td className="text-right">{h.shares}</td>
                        <td className="text-right">{fmt.format(currPrice)}</td>
                        <td className="text-right">{fmt.format(costTotal)}</td>
                        <td className="text-right font-bold">{fmt.format(totalVal)}</td>
                        <td className={`text-right ${isPos ? 'text-green' : 'text-red'}`}>{fmt.format(pnl)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {selectedHolding && (
        <TickerDetailsModal 
          holding={selectedHolding}
          onClose={() => setSelectedHolding(null)}
        />
      )}
    </>
  );
}
