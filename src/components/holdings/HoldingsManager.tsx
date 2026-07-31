import { useState, useEffect } from 'react';
import { useApi } from '../../hooks/useApi';
import { apiClient } from '../../services/apiClient';
import { Holding, fmt, fmtDec } from '../../lib/types';
import { HoldingFormModal } from './HoldingFormModal';

export function HoldingsManager() {
  const [activeTab, setActiveTab] = useState<'stocks' | 'etfs'>('stocks');
  const { getHoldings, getApiConfig, updateHoldingPrices } = useApi();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fetchingPrices, setFetchingPrices] = useState(false);

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

  const handleFetchPrices = async () => {
    setFetchingPrices(true);
    try {
      const tickers = holdings.map(h => h.ticker);
      if (tickers.length === 0) return;

      const updates: { ticker: string; price: number }[] = [];
      for (const ticker of tickers) {
        try {
          const quote = await apiClient.fetchQuote(ticker);
          if (quote && quote.c) {
            updates.push({ ticker, price: quote.c });
          }
        } catch (qErr) {
          console.error(`Failed to fetch quote for ${ticker}`, qErr);
        }
      }
      
      if (updates.length > 0) {
        await updateHoldingPrices(updates);
        await fetchHoldings();
      }
    } catch (err) {
      console.error(err);
      alert('Error fetching live prices: ' + err);
    } finally {
      setFetchingPrices(false);
    }
  };

  useEffect(() => {
    fetchHoldings();
  }, []);

  const displayedHoldings = holdings.filter(h => h.asset_type === (activeTab === 'stocks' ? 'stock' : 'etf'));

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Holdings Manager</h1>
          <p className="subtitle">Manage individual stocks and ETF positions</p>
        </div>
        <div>
          <button className="btn btn-secondary" onClick={handleFetchPrices} disabled={fetchingPrices}>
            {fetchingPrices ? 'Fetching...' : '☁ Live Prices'}
          </button>
          <button className="btn ml-2" style={{ marginLeft: 8 }} onClick={fetchHoldings}>
            ↻ Refresh
          </button>
          <button className="btn ml-2" style={{ marginLeft: 8 }} onClick={() => setIsModalOpen(true)}>
            + Add Position
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-2 mt-2">
        <button 
          className={activeTab === 'stocks' ? 'btn' : 'btn btn-secondary'}
          onClick={() => setActiveTab('stocks')}
        >
          Single Stocks
        </button>
        <button 
          className={activeTab === 'etfs' ? 'btn' : 'btn btn-secondary'}
          onClick={() => setActiveTab('etfs')}
        >
          Core ETFs
        </button>
      </div>

      <div className="panel">
        <div className="panel-header">
          <span>{activeTab === 'stocks' ? 'Stock Portfolio' : 'ETF Sleeves'}</span>
        </div>
        
        <table className="data-table mt-2">
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Shares</th>
              <th>Avg Cost Basis</th>
              <th>Current Price</th>
              <th>Total Value</th>
              <th>Status / Config</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-muted">
                  Loading...
                </td>
              </tr>
            ) : displayedHoldings.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-muted">
                  No {activeTab} found. Click 'Seed Data' on the Dashboard or add manually.
                </td>
              </tr>
            ) : (
              displayedHoldings.map((h) => {
                const totalValue = h.shares * (h.current_price || 0);
                return (
                  <tr key={h.id || h.ticker}>
                    <td className="font-bold text-blue">{h.ticker}</td>
                    <td>{h.shares.toLocaleString()}</td>
                    <td>{fmtDec.format(h.avg_cost_basis)}</td>
                    <td>{h.current_price ? fmtDec.format(h.current_price) : '--'}</td>
                    <td>{fmt.format(totalValue)}</td>
                    <td>
                      {h.is_tax_loss_reserve ? (
                        <span className="badge badge-red">Tax Loss Reserve</span>
                      ) : activeTab === 'stocks' && h.contracts_desc ? (
                        <span className="badge badge-purple">{h.contracts_desc}</span>
                      ) : activeTab === 'etfs' && h.rate_per_lot ? (
                        <span className="badge badge-green">${h.rate_per_lot}/lot</span>
                      ) : (
                        <span className="text-muted">--</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <HoldingFormModal
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => {
            setIsModalOpen(false);
            fetchHoldings();
          }}
        />
      )}
    </>
  );
}
