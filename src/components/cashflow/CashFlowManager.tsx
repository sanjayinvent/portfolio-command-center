import { useState, useEffect } from 'react';
import { useApi } from '../../hooks/useApi';
import { Holding, fmt } from '../../lib/types';

export function CashFlowManager() {
  const { getHoldings } = useApi();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHoldings = async () => {
      try {
        const data = await getHoldings();
        setHoldings(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchHoldings();
  }, []);

  const FRESH_CASH = 5000;
  
  let stockOptIncome = 0;
  holdings.filter(h => h.asset_type === 'stock').forEach(s => {
    stockOptIncome += s.call_yield_estimate || 0;
  });

  let etfOptIncome = 0;
  holdings.filter(h => h.asset_type === 'etf').forEach(e => {
    const lots = Math.floor(e.shares / 100);
    etfOptIncome += lots * (e.rate_per_lot || 0);
  });

  const totalVal = holdings.reduce((sum, h) => sum + (h.shares * (h.current_price || h.market_price || 0)), 0);
  const divIncome = totalVal * 0.0012;

  const totalGenerated = stockOptIncome + etfOptIncome + divIncome;
  const totalSweep = FRESH_CASH + totalGenerated;
  const taxReserve = totalGenerated * 0.25;

  if (loading) return <div className="p-4">Loading cash flows...</div>;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Cash Flow & Tax Center</h1>
          <p className="subtitle">Monthly Deployment Sweeps & IRS Liabilities</p>
        </div>
      </div>

      <div className="kpi-row mt-4">
        <div className="kpi-chip">
          <span className="kpi-label">Gross Monthly Sweep</span>
          <span className="kpi-value text-blue">{fmt.format(totalSweep)}</span>
          <span className="kpi-sub">Ready to deploy</span>
        </div>
        <div className="kpi-chip">
          <span className="kpi-label">Fresh Capital</span>
          <span className="kpi-value">{fmt.format(FRESH_CASH)}</span>
          <span className="kpi-sub text-muted">From W2</span>
        </div>
        <div className="kpi-chip">
          <span className="kpi-label">Yield Generated</span>
          <span className="kpi-value text-green">{fmt.format(totalGenerated)}</span>
          <span className="kpi-sub">Options + Divs</span>
        </div>
        <div className="kpi-chip" style={{ borderLeft: '3px solid var(--accent-red)' }}>
          <span className="kpi-label">Tax Reserve Needed</span>
          <span className="kpi-value text-red">{fmt.format(taxReserve)}</span>
          <span className="kpi-sub">25% Bracket Estimate</span>
        </div>
      </div>

      <div className="panel mt-4">
        <div className="panel-header mb-4">
          <span>Income Breakdown (Current Run-Rate)</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Source</th>
              <th>Description</th>
              <th className="text-right">Monthly Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="font-bold">Fresh Capital</td>
              <td className="text-muted">Standard monthly W2 savings sweep</td>
              <td className="text-right">{fmt.format(FRESH_CASH)}</td>
            </tr>
            <tr>
              <td className="font-bold">Single-Stock Options</td>
              <td className="text-muted">Covered calls on NVDA, MSFT, etc.</td>
              <td className="text-right text-green">+{fmt.format(stockOptIncome)}</td>
            </tr>
            <tr>
              <td className="font-bold">ETF Options</td>
              <td className="text-muted">Covered calls on active ETF lots</td>
              <td className="text-right text-green">+{fmt.format(etfOptIncome)}</td>
            </tr>
            <tr>
              <td className="font-bold">Dividend Yield</td>
              <td className="text-muted">Estimated 0.12% monthly blended yield</td>
              <td className="text-right text-green">+{fmt.format(divIncome)}</td>
            </tr>
            <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
              <td className="font-bold border-t" colSpan={2}>Total Taxable Yield Generated</td>
              <td className="font-bold border-t text-right">{fmt.format(totalGenerated)}</td>
            </tr>
            <tr style={{ background: 'rgba(255,0,0,0.05)' }}>
              <td className="font-bold text-red" colSpan={2}>Estimated Tax Liability (25%)</td>
              <td className="font-bold text-red text-right">-{fmt.format(taxReserve)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
