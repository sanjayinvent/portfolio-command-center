import { useState, useEffect } from 'react';
import { apiClient, Holding, OptionContract, ApiConfig } from '../services/apiClient';

export function useApi() {
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const getHoldings = async (): Promise<Holding[]> => {
    try {
      return await apiClient.getHoldings();
    } catch (err) {
      console.error('Failed to fetch holdings', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      return [];
    }
  };

  const getOptionContracts = async (): Promise<OptionContract[]> => {
    try {
      return await apiClient.getOptionContracts();
    } catch (err) {
      console.error('Failed to fetch option contracts', err);
      return [];
    }
  };

  const getTransactions = async (): Promise<any[]> => {
    return [];
  };

  const getApiConfig = async (provider: string): Promise<ApiConfig | null> => {
    try {
      return await apiClient.getApiConfig(provider);
    } catch (err) {
      console.error('Failed to fetch API config', err);
      return null;
    }
  };

  const saveApiConfig = async (
    provider: string,
    apiKey: string,
    oauthToken?: string,
    oauthRefreshToken?: string,
    tokenExpiry?: number
  ) => {
    return await apiClient.saveApiConfig(provider, apiKey, oauthToken, oauthRefreshToken, tokenExpiry);
  };

  const updateHoldingPrices = async (updates: { ticker: string; price: number }[]) => {
    return await apiClient.updateHoldingPrices(updates);
  };

  const addHolding = async (holding: Partial<Holding>) => {
    return await apiClient.addHolding(holding);
  };

  const restoreHoldings = async (holdings: Holding[]) => {
    return await apiClient.restoreHoldings(holdings);
  };

  const addOptionContract = async (contract: any) => {
    return await apiClient.addOptionContract(contract);
  };

  return {
    db: true, // Legacy compatibility flag
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
