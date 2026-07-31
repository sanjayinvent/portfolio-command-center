/**
 * Portfolio Command Center V2 API Client
 * Interfaces with the FastAPI Backend (http://localhost:8000/api/v1)
 */

const API_BASE = '/api/v1'; // Proxied via NGINX or Vite dev server fallback to http://localhost:8000

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  try {
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(errorData.detail || `HTTP Error ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    // If running Vite standalone on port 1420 without NGINX proxy, retry direct to FastAPI port 8000
    if (!endpoint.startsWith('http://localhost:8000')) {
      return request<T>(`http://localhost:8000${API_BASE}${endpoint}`, options);
    }
    throw err;
  }
}

export interface Holding {
  id?: number;
  ticker: string;
  name?: string;
  asset_type: string;
  shares: number;
  avg_cost_basis: number;
  cost_basis?: number;
  current_price: number;
  market_price?: number;
  is_tax_loss_reserve?: boolean;
  call_yield_estimate?: number;
  contracts_desc?: string;
  rate_per_lot?: number;
  notes?: string;
}

export interface OptionContract {
  id?: number;
  holding_id?: number;
  symbol: string;
  contract_type?: string;
  option_type?: string;
  strike_price?: number;
  strike?: number;
  expiration_date: string;
  contracts?: number;
  quantity?: number;
  premium_received?: number;
  cost_basis?: number;
  open_date?: string;
  status?: string;
}

export interface ApiConfig {
  provider: string;
  api_key?: string;
  app_key?: string;
  oauth_token?: string;
  oauth_refresh_token?: string;
  token_expiry?: number | string;
  is_active?: boolean;
}

export const apiClient = {
  // Holdings
  getHoldings: async (): Promise<Holding[]> => {
    return await request<Holding[]>('/holdings');
  },

  addHolding: async (holding: Partial<Holding>): Promise<Holding> => {
    return await request<Holding>('/holdings', {
      method: 'POST',
      body: JSON.stringify({
        ticker: holding.ticker,
        name: holding.name || holding.ticker,
        asset_type: holding.asset_type || 'stock',
        shares: holding.shares || 0,
        cost_basis: holding.avg_cost_basis || holding.cost_basis || 0,
        market_price: holding.current_price || holding.market_price || 0,
        is_tax_loss_reserve: holding.is_tax_loss_reserve || false,
        call_yield_estimate: holding.call_yield_estimate || 0,
        contracts_desc: holding.contracts_desc || null,
        rate_per_lot: holding.rate_per_lot || 0,
        notes: holding.notes || null,
      }),
    });
  },

  updateHoldingPrices: async (updates: { ticker: string; price: number }[]): Promise<void> => {
    await request('/holdings/prices', {
      method: 'POST',
      body: JSON.stringify(updates),
    });
  },

  restoreHoldings: async (holdings: Holding[]): Promise<void> => {
    await request('/holdings/restore', {
      method: 'POST',
      body: JSON.stringify(holdings),
    });
  },

  deleteHolding: async (ticker: string): Promise<void> => {
    await request(`/holdings/${ticker}`, {
      method: 'DELETE',
    });
  },

  // Option Contracts
  getOptionContracts: async (): Promise<OptionContract[]> => {
    return await request<OptionContract[]>('/option_contracts');
  },

  addOptionContract: async (contract: any): Promise<OptionContract> => {
    return await request<OptionContract>('/option_contracts', {
      method: 'POST',
      body: JSON.stringify({
        holding_id: contract.holding_id,
        symbol: contract.symbol || contract.ticker || 'UNKNOWN',
        option_type: contract.contract_type || contract.option_type || 'call',
        strike: contract.strike_price || contract.strike || 0,
        expiration_date: contract.expiration_date || '2026-08-21',
        quantity: contract.contracts || contract.quantity || 1,
        cost_basis: contract.premium_received || contract.cost_basis || 0,
        current_price: contract.current_price || 0,
      }),
    });
  },

  // API Config
  getApiConfig: async (provider: string): Promise<ApiConfig | null> => {
    return await request<ApiConfig>(`/config/${provider}`);
  },

  saveApiConfig: async (
    provider: string,
    apiKey: string,
    oauthToken?: string,
    oauthRefreshToken?: string,
    tokenExpiry?: number
  ): Promise<void> => {
    await request('/config', {
      method: 'POST',
      body: JSON.stringify({
        provider,
        app_key: apiKey,
        oauth_token: oauthToken || null,
        oauth_refresh_token: oauthRefreshToken || null,
        token_expiry: tokenExpiry ? tokenExpiry.toString() : null,
      }),
    });
  },

  // Quotes
  fetchQuote: async (symbol: string): Promise<{ c: number }> => {
    return await request<{ c: number }>(`/quote/${symbol}`);
  },

  // Option Strategy Simulator
  simulateStrategy: async (params: {
    ticker: string;
    cost_basis: number;
    shares?: number;
    cc_strike_pct?: number;
    collar_call_pct?: number;
    collar_put_pct?: number;
    csp_strike_pct?: number;
  }) => {
    const query = new URLSearchParams({
      ticker: params.ticker,
      cost_basis: params.cost_basis.toString(),
      shares: (params.shares || 100).toString(),
      cc_strike_pct: (params.cc_strike_pct || 5).toString(),
      collar_call_pct: (params.collar_call_pct || 5).toString(),
      collar_put_pct: (params.collar_put_pct || 5).toString(),
      csp_strike_pct: (params.csp_strike_pct || 5).toString(),
    });
    return await request(`/options/simulate?${query.toString()}`, {
      method: 'POST',
    });
  },
};
