import { useState, useEffect } from 'react';
import { useApi } from '../../hooks/useApi';
import { Holding, fmt } from '../../lib/types';

export function OptionsManager() {
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

  const etfs = holdings.filter(h => h.asset_type === 'etf');
  const optionStocks = holdings.filter(h => h.asset_type === 'stock' && h.contracts_desc && !h.is_tax_loss_reserve);

  if (loading) return <div className="p-4">Loading options desk...</div>;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Options Desk</h1>
          <p className="subtitle">Covered Calls & ETF Lot Monetization Tracker</p>
        </div>
      </div>

      <div className="grid-split mt-4">
        {/* Active Covered Calls */}
        <div className="panel">
          <div className="panel-header mb-4">
            <span>Single-Stock Covered Calls</span>
          </div>
          {optionStocks.length === 0 ? (
            <p className="text-muted text-sm">No active single-stock options found.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {optionStocks.map(stock => {
                const totalVal = stock.shares * (stock.current_price || stock.market_price || 0);
                return (
                  <div key={stock.id || stock.ticker} className="flex justify-between items-center p-3" style={{ border: '1px solid var(--border)', borderRadius: '4px' }}>
                    <div>
                      <div className="font-bold text-blue">{stock.ticker}</div>
                      <div className="text-xs text-muted">{stock.shares} shares | Val: {fmt.format(totalVal)}</div>
                    </div>
                    <div className="text-right">
                      <div className="badge badge-purple">{stock.contracts_desc}</div>
                      <div className="text-xs text-green mt-1">Est Yield: {fmt.format(stock.call_yield_estimate || 0)}/mo</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ETF Lot Tracker */}
        <div className="panel">
          <div className="panel-header mb-4">
            <span>ETF Lot Monetization Progress</span>
          </div>
          <p className="text-xs text-muted mb-4">
            Track progress towards 100-share blocks to unlock new covered call lots.
          </p>
          <div className="flex flex-col gap-4">
            {etfs.map(etf => {
              const fullLots = Math.floor(etf.shares / 100);
              const remainder = etf.shares % 100;
              const progressPct = remainder;
              
              return (
                <div key={etf.id || etf.ticker}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-bold">{etf.ticker} <span className="text-muted font-normal ml-1">({etf.shares.toFixed(2)} sh)</span></span>
                    <span className="text-green font-bold">{fullLots} Active Lots</span>
                  </div>
                  <div className="allocation-bar" style={{ height: '8px', background: 'rgba(255,255,255,0.05)' }}>
                    <div className="segment-etf" style={{ width: `${progressPct}%`, background: 'var(--accent-blue)' }}></div>
                  </div>
                  <div className="flex justify-between text-xs mt-1 text-muted">
                    <span>{progressPct.toFixed(1)}% to next lot</span>
                    <span>Rate: ${etf.rate_per_lot || 0}/lot</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
