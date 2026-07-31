import { useState, useEffect } from 'react';
import Database from '@tauri-apps/plugin-sql';
import { Holding, Transaction, CashFlow, OptionContract } from '../lib/types';

let dbInstance: Database | null = null;

export function useDatabase() {
  const [db, setDb] = useState<Database | null>(dbInstance);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function initDb() {
      if (dbInstance) {
        setDb(dbInstance);
        setIsInitializing(false);
        return;
      }
      try {
        // Tauri sql plugin creates/opens the database
        const loadedDb = await Database.load('sqlite:portfolio.db');
        dbInstance = loadedDb;
        setDb(loadedDb);
      } catch (err) {
        console.error('Failed to load database', err);
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsInitializing(false);
      }
    }
    
    initDb();
  }, []);

  // Helpers for common queries
  const getHoldings = async (): Promise<Holding[]> => {
    if (!db) return [];
    return await db.select<Holding[]>('SELECT * FROM holdings ORDER BY id ASC');
  };

  const getOptionContracts = async (): Promise<OptionContract[]> => {
    if (!db) return [];
    return await db.select<OptionContract[]>('SELECT * FROM option_contracts ORDER BY expiration_date ASC');
  };

  const getTransactions = async (): Promise<Transaction[]> => {
    if (!db) return [];
    return await db.select<Transaction[]>('SELECT * FROM transactions ORDER BY executed_at DESC');
  };

  const getApiConfig = async (provider: string): Promise<any> => {
    if (!db) return null;
    const res = await db.select<any[]>('SELECT * FROM api_config WHERE provider = $1', [provider]);
    return res.length > 0 ? res[0] : null;
  };

  const saveApiConfig = async (
    provider: string, 
    apiKey: string, 
    oauthToken?: string, 
    oauthRefreshToken?: string, 
    tokenExpiry?: number
  ) => {
    if (!db) return;
    await db.execute(
      `INSERT INTO api_config (provider, api_key, oauth_token, oauth_refresh_token, token_expiry, is_active) 
       VALUES ($1, $2, $3, $4, $5, 1) 
       ON CONFLICT(provider) DO UPDATE SET 
       api_key = $2, 
       oauth_token = $3, 
       oauth_refresh_token = $4, 
       token_expiry = $5, 
       is_active = 1`,
      [
        provider, 
        apiKey, 
        oauthToken || null, 
        oauthRefreshToken || null, 
        tokenExpiry ? tokenExpiry.toString() : null
      ]
    );
  };

  const updateHoldingPrices = async (updates: { ticker: string, price: number }[]) => {
    if (!db) return;
    for (const u of updates) {
      await db.execute('UPDATE holdings SET current_price = $1, last_price_update = datetime("now") WHERE ticker = $2', [u.price, u.ticker]);
    }
  };

  const addHolding = async (holding: Partial<Holding>) => {
    if (!db) return;
    await db.execute(
      'INSERT INTO holdings (ticker, asset_type, shares, avg_cost_basis, current_price, is_tax_loss_reserve, call_yield_estimate, contracts_desc, rate_per_lot, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [
        holding.ticker,
        holding.asset_type,
        holding.shares || 0,
        holding.avg_cost_basis || 0,
        holding.current_price || 0,
        holding.is_tax_loss_reserve ? 1 : 0,
        holding.call_yield_estimate || 0,
        holding.contracts_desc || null,
        holding.rate_per_lot || 0,
        holding.notes || null,
      ]
    );
  };

  const restoreHoldings = async (holdings: Holding[]) => {
    if (!db) return;
    await db.execute('DELETE FROM holdings');
    for (const holding of holdings) {
      await addHolding(holding);
    }
  };

  const addOptionContract = async (contract: any) => {
    if (!db) return;
    await db.execute(
      'INSERT INTO option_contracts (holding_id, contract_type, strike_price, expiration_date, contracts, premium_received, open_date, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [
        contract.holding_id,
        contract.contract_type || 'call',
        contract.strike_price || 0,
        contract.expiration_date || '2026-08-21',
        contract.contracts || 1,
        contract.premium_received || 0,
        contract.open_date || '2026-07-30',
        contract.status || 'open'
      ]
    );
  };

  return {
    db,
    isInitializing,
    error,
    getHoldings,
    getOptionContracts,
    getTransactions,
    getApiConfig,
    saveApiConfig,
    updateHoldingPrices,
    addHolding,
    addOptionContract,
    restoreHoldings,
  };
}
