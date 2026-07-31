import { useState } from 'react';
import { useDatabase } from '../../hooks/useDatabase';

interface HoldingFormModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function HoldingFormModal({ onClose, onSuccess }: HoldingFormModalProps) {
  const { addHolding } = useDatabase();
  const [ticker, setTicker] = useState('');
  const [assetType, setAssetType] = useState<'stock'|'etf'>('stock');
  const [shares, setShares] = useState(0);
  const [avgCostBasis, setAvgCostBasis] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker) return;
    setSubmitting(true);
    try {
      await addHolding({
        ticker: ticker.toUpperCase(),
        asset_type: assetType,
        shares,
        avg_cost_basis: avgCostBasis,
        current_price: avgCostBasis,
      });
      onSuccess();
    } catch (err) {
      console.error(err);
      alert('Failed to add holding');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50 p-4" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card w-full max-w-md" style={{ width: '400px', backgroundColor: 'var(--panel-bg)' }}>
        <div className="panel-header mb-4">
          <span>Add New Position</span>
          <button className="text-muted cursor-pointer" style={{background:'none', border:'none', color:'inherit', cursor:'pointer'}} onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="input-group">
            <label>Ticker Symbol</label>
            <input 
              type="text" 
              value={ticker}
              onChange={e => setTicker(e.target.value)}
              placeholder="e.g. AAPL" 
              required 
            />
          </div>
          <div className="input-group">
            <label>Asset Type</label>
            <select value={assetType} onChange={e => setAssetType(e.target.value as 'stock'|'etf')}>
              <option value="stock">Single Stock</option>
              <option value="etf">Core ETF</option>
            </select>
          </div>
          <div className="grid-2">
            <div className="input-group">
              <label>Shares</label>
              <input 
                type="number" 
                step="any"
                value={shares}
                onChange={e => setShares(parseFloat(e.target.value) || 0)}
                min="0" 
                required 
              />
            </div>
            <div className="input-group">
              <label>Avg Cost Basis</label>
              <input 
                type="number" 
                step="any"
                value={avgCostBasis}
                onChange={e => setAvgCostBasis(parseFloat(e.target.value) || 0)}
                min="0" 
                required 
              />
            </div>
          </div>
          <div className="flex justify-between mt-4">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn" disabled={submitting}>
              {submitting ? 'Adding...' : 'Add Position'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
