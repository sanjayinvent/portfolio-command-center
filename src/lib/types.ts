// ─── Core Data Types ────────────────────────────────────────────────────────

export interface Holding {
  id: number;
  ticker: string;
  asset_type: 'stock' | 'etf';
  shares: number;
  avg_cost_basis: number;
  current_price: number | null;
  last_price_update: string | null;
  is_tax_loss_reserve: boolean;
  call_yield_estimate: number;
  contracts_desc: string | null;
  rate_per_lot: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OptionContract {
  id: number;
  holding_id: number;
  contract_type: 'call' | 'put';
  strike_price: number;
  expiration_date: string;
  contracts: number;
  premium_received: number;
  open_date: string;
  close_date: string | null;
  status: 'open' | 'closed' | 'assigned' | 'expired';
  delta: number | null;
  schwab_order_id: string | null;
  created_at: string;
}

export interface Transaction {
  id: number;
  holding_id: number | null;
  action: 'buy' | 'sell' | 'dividend' | 'option_premium' | 'assignment';
  ticker: string;
  shares: number | null;
  price: number | null;
  total_value: number;
  funding_source: string | null;
  schwab_confirmation: string | null;
  executed_at: string;
  created_at: string;
}

export interface CashFlow {
  id: number;
  month: string;
  fresh_cash_inflow: number;
  options_income: number;
  dividend_income: number;
  total_deployed: number;
  tax_estimate: number;
  strategy_phase: string | null;
  notes: string | null;
  created_at: string;
}

export interface SimulationScenario {
  id: number;
  name: string;
  description: string | null;
  monthly_fresh_cash: number;
  growth_rate_monthly: number;
  tax_rate: number;
  strategy_config: string | null;
  created_at: string;
}

export interface SimulationSnapshot {
  id: number;
  scenario_id: number;
  month_index: number;
  date_label: string | null;
  total_value: number | null;
  stock_value: number | null;
  etf_value: number | null;
  monthly_sweep: number | null;
  cumulative_swept: number | null;
  tax_estimate: number | null;
  holdings_snapshot: string | null;
  trades: string | null;
  created_at: string;
}

export interface ApiConfig {
  id: number;
  provider: 'finnhub' | 'schwab' | 'polygon' | 'alpha_vantage';
  api_key: string | null;
  is_active: boolean;
  last_synced: string | null;
  created_at: string;
}

// ─── API Response Types ─────────────────────────────────────────────────────

export interface FinnhubQuote {
  c: number;  // Current price
  d: number;  // Change
  dp: number; // Percent change
  h: number;  // High
  l: number;  // Low
  o: number;  // Open
  pc: number; // Previous close
  t: number;  // Timestamp
}

// ─── Simulation Types ───────────────────────────────────────────────────────

export interface SimulatedTrade {
  action: 'BUY' | 'SELL';
  ticker: string;
  shares: number;
  price: number;
  val: number;
  source: string;
}

export interface MonthSnapshot {
  monthIndex: number;
  dateLabel: string;
  totalVal: number;
  stockVal: number;
  etfVal: number;
  stockPct: number;
  etfPct: number;
  monthlySweep: number;
  phaseTitle: string;
  phaseDesc: string;
  phaseBadge: string;
  isEarningsMonth: boolean;
  stocks: StockState[];
  etfs: EtfState[];
  cumSwept: number;
  singleStockOptIncome: number;
  etfOptIncome: number;
  divIncome: number;
  monthlyTaxEst: number;
  calYearTaxEst: number;
  trades: SimulatedTrade[];
}

export interface StockState {
  ticker: string;
  shares: number;
  price: number;
  callYield: number;
  contracts: string;
}

export interface EtfState {
  ticker: string;
  baseShares: number;
  newShares: number;
  price: number;
  ratePerLot: number;
}

// ─── Formatters ─────────────────────────────────────────────────────────────

export const fmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
});

export const fmtDec = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
});

export const fmtPct = (val: number): string => {
  return `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`;
};
