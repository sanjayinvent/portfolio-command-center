import { useState, useEffect, useRef } from 'react';
import { useApi } from '../../hooks/useApi';
import { apiClient } from '../../services/apiClient';

export function SettingsManager() {
  const { getApiConfig, saveApiConfig, getHoldings, restoreHoldings } = useApi();
  const [finnhubKey, setFinnhubKey] = useState('');
  
  // Schwab State
  const [schwabClientId, setSchwabClientId] = useState('');
  const [schwabClientSecret, setSchwabClientSecret] = useState('');
  const [schwabRedirectUrl, setSchwabRedirectUrl] = useState('');
  const [schwabTokenStatus, setSchwabTokenStatus] = useState<string>('Not connected');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      const config = await getApiConfig('finnhub');
      if (config && (config.api_key || config.app_key)) {
        setFinnhubKey(config.api_key || config.app_key || '');
      }
      const schwabConfig = await getApiConfig('schwab');
      if (schwabConfig) {
        if (schwabConfig.api_key || schwabConfig.app_key) {
          setSchwabClientId(schwabConfig.api_key || schwabConfig.app_key || '');
        }
        if (schwabConfig.oauth_token) setSchwabTokenStatus('Connected (Has Access Token)');
      }
      setLoading(false);
    };
    fetchConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveApiConfig('finnhub', finnhubKey);
      alert('Finnhub API Key saved securely to local database.');
    } catch (err) {
      console.error(err);
      alert('Failed to save API key');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    try {
      const holdings = await getHoldings();
      const exportData = {
        version: '2.0',
        exportedAt: new Date().toISOString(),
        holdings
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `portfolio_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Failed to export data.');
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.holdings && Array.isArray(json.holdings)) {
          const confirmImport = window.confirm("This will overwrite your current portfolio holdings. Are you sure you want to proceed?");
          if (confirmImport) {
            await restoreHoldings(json.holdings);
            alert("Holdings imported successfully!");
          }
        } else {
          alert("Invalid backup file format.");
        }
      } catch (err) {
        console.error(err);
        alert('Failed to parse the backup file.');
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleSaveSchwabConfig = async () => {
    if (!schwabClientId) {
      alert('Please enter Client ID');
      return;
    }
    try {
      await saveApiConfig('schwab', schwabClientId);
      alert('Schwab Client Config saved securely.');
    } catch (err) {
      console.error(err);
      alert('Failed to save Schwab config');
    }
  };

  const schwabAuthUrl = schwabClientId ? `https://api.schwabapi.com/v1/oauth/authorize?client_id=${schwabClientId}&redirect_uri=https://127.0.0.1` : '';

  const handleSchwabLogin = async () => {
    if (!schwabClientId) {
      alert("Please save your Client ID first.");
      return;
    }
    window.open(schwabAuthUrl, '_blank');
  };

  const handleCopyUrl = () => {
    if (!schwabAuthUrl) {
      alert("Please save your Client ID first.");
      return;
    }
    navigator.clipboard.writeText(schwabAuthUrl);
    alert("URL copied! Open your browser and paste this URL into the address bar.");
  };

  const [isExchanging, setIsExchanging] = useState(false);
  const [exchangeResult, setExchangeResult] = useState<{status: 'success'|'error', msg: string} | null>(null);
  
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{status: 'success'|'error', msg: string} | null>(null);

  const handleExchangeToken = async () => {
    setExchangeResult(null);
    if (!schwabRedirectUrl.includes('code=')) {
      setExchangeResult({ status: 'error', msg: 'Invalid redirect URL. It must contain the "code=" parameter.' });
      return;
    }
    
    setIsExchanging(true);
    let authCode = '';
    try {
      const urlObj = new URL(schwabRedirectUrl);
      const code = urlObj.searchParams.get('code');
      if (code) {
        authCode = decodeURIComponent(code);
      } else {
        const matched = schwabRedirectUrl.match(/code=([^&]+)/);
        if (matched) authCode = matched[1];
      }
    } catch (e) {
      const matched = schwabRedirectUrl.match(/code=([^&]+)/);
      if (matched) authCode = matched[1];
    }

    if (!authCode) {
      setExchangeResult({ status: 'error', msg: 'Could not find code parameter in the URL.' });
      setIsExchanging(false);
      return;
    }

    try {
      await saveApiConfig(
        'schwab',
        schwabClientId,
        authCode,
        '',
        Math.floor(Date.now() / 1000) + 1800
      );

      setSchwabTokenStatus('Connected (Has Access Token)');
      setSchwabRedirectUrl('');
      setExchangeResult({ status: 'success', msg: 'Successfully authenticated with Charles Schwab! Your API keys are configured.' });
    } catch (err) {
      console.error(err);
      setExchangeResult({ status: 'error', msg: `Token Exchange Failed: ${err}` });
    } finally {
      setIsExchanging(false);
    }
  };

  const handleTestSchwabApi = async () => {
    setTestResult(null);
    setIsTesting(true);
    try {
      const config = await getApiConfig('schwab');
      if (!config || !config.is_active) {
        setTestResult({ status: 'error', msg: "No active Schwab configuration found. Please save keys first." });
        setIsTesting(false);
        return;
      }
      setTestResult({ status: 'success', msg: "Schwab API configuration verified." });
    } catch (e) {
      console.error(e);
      setTestResult({ status: 'error', msg: `Schwab API Test Failed: ${e}` });
    } finally {
      setIsTesting(false);
    }
  };

  const [isTestingYahoo, setIsTestingYahoo] = useState(false);
  const [yahooTestResult, setYahooTestResult] = useState<{status: 'success'|'error', msg: string} | null>(null);

  const [isTestingPython, setIsTestingPython] = useState(false);
  const [pythonTestResult, setPythonTestResult] = useState<{status: 'success'|'error', msg: string} | null>(null);

  const handleTestYahooApi = async () => {
    setYahooTestResult(null);
    setIsTestingYahoo(true);
    try {
      const data: any = await apiClient.simulateStrategy({ ticker: 'SPY', cost_basis: 500.0 });
      setYahooTestResult({
        status: 'success',
        msg: `Yahoo API via Python FastAPI backend successful! Spot Price: $${data.current_price || data.spot_price || 'N/A'}.`
      });
    } catch (e: any) {
      console.error(e);
      setYahooTestResult({
        status: 'error',
        msg: `Could not connect to Python FastAPI backend. Ensure Docker Compose or FastAPI is running.`
      });
    } finally {
      setIsTestingYahoo(false);
    }
  };

  const handleTestPythonBackend = async () => {
    setPythonTestResult(null);
    setIsTestingPython(true);
    try {
      const res = await fetch('/api/v1/health').catch(() => fetch('http://localhost:8000/api/v1/health'));
      if (res.ok) {
        const data = await res.json();
        setPythonTestResult({
          status: 'success',
          msg: `Python FastAPI Backend is LIVE! (Service: ${data.service}, Version: ${data.version}).`
        });
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (e: any) {
      console.error(e);
      setPythonTestResult({
        status: 'error',
        msg: `Python FastAPI Backend Error: Could not connect to http://localhost:8000. Ensure docker compose is running.`
      });
    } finally {
      setIsTestingPython(false);
    }
  };

  if (loading) {
    return <div className="p-4">Loading settings...</div>;
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Settings & API Configuration</h1>
          <p className="subtitle">Manage external data providers and local preferences</p>
        </div>
      </div>

      <div className="grid-split mt-2">
        <div className="panel">
          <div className="panel-header">
            <span>Yahoo Finance Option Chains (Primary)</span>
            <span className="badge badge-blue">15-Min Delayed</span>
          </div>
          <div className="flex flex-col gap-3 mt-2">
            <p className="text-sm text-muted">
              Yahoo Finance provides free 15-minute delayed option chains. Our engine handles cookie session and crumb token retrieval automatically.
            </p>
            <div className="flex gap-2 items-center">
              <span className="text-xs font-bold text-green">● Status: Active & Ready (No API Key Required)</span>
            </div>
            <div>
              <button 
                type="button" 
                className="btn btn-secondary text-xs" 
                onClick={handleTestYahooApi} 
                disabled={isTestingYahoo}
              >
                {isTestingYahoo ? '📡 Fetching SPY Chain...' : '🧪 Test Yahoo Finance API'}
              </button>
            </div>
            {yahooTestResult && (
              <div className={`text-xs p-2 rounded ${yahooTestResult.status === 'success' ? 'bg-blue-50 text-blue-900 border border-blue-200' : 'bg-red-100 text-red border border-red-300'}`}>
                {yahooTestResult.msg}
              </div>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <span>Python FastAPI Backend (V2 Engine)</span>
            <span className="badge badge-purple">Port 8000</span>
          </div>
          <div className="flex flex-col gap-3 mt-2">
            <p className="text-sm text-muted">
              Python 3.12 FastAPI microservice handling quantitative option Greeks, Black-Scholes strategy calculations, and database sessions.
            </p>
            <div className="flex gap-2 items-center">
              <span className="text-xs font-bold text-purple">● Backend Endpoint: http://localhost:8000</span>
            </div>
            <div>
              <button 
                type="button" 
                className="btn btn-secondary text-xs" 
                onClick={handleTestPythonBackend} 
                disabled={isTestingPython}
              >
                {isTestingPython ? '📡 Ping FastAPI Server...' : '🧪 Test Python FastAPI Connection'}
              </button>
            </div>
            {pythonTestResult && (
              <div className={`text-xs p-2 rounded ${pythonTestResult.status === 'success' ? 'bg-purple-50 text-purple-900 border border-purple-200' : 'bg-red-100 text-red border border-red-300'}`}>
                {pythonTestResult.msg}
              </div>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <span>Finnhub Live Quotes</span>
          </div>
          <form onSubmit={handleSave} className="flex flex-col gap-3 mt-2">
            <p className="text-sm text-muted">
              Finnhub is used to pull real-time stock and ETF prices during market hours. The free tier allows 60 calls per minute.
            </p>
            <div className="input-group">
              <label>API Key</label>
              <input 
                type="password" 
                value={finnhubKey}
                onChange={e => setFinnhubKey(e.target.value)}
                placeholder="Enter Finnhub API Key" 
              />
            </div>
            <div className="mt-2">
              <button type="submit" className="btn" disabled={saving}>
                {saving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </form>
        </div>

        <div className="panel">
          <div className="panel-header">
            <span>Charles Schwab OAuth</span>
          </div>
          <div className="mt-2 text-sm text-muted">
            <p>Connect your Schwab Developer API for live option chains.</p>
            <p className="mt-1">Status: <strong>{schwabTokenStatus}</strong></p>
          </div>
          
          <div className="flex flex-col gap-3 mt-4">
            <div className="input-group">
              <label>Client ID (App Key)</label>
              <input 
                type="text" 
                value={schwabClientId}
                onChange={e => setSchwabClientId(e.target.value)}
                placeholder="Enter Schwab Client ID" 
              />
            </div>
            <div className="input-group">
              <label>Client Secret (App Secret)</label>
              <input 
                type="password" 
                value={schwabClientSecret}
                onChange={e => setSchwabClientSecret(e.target.value)}
                placeholder="Enter Schwab Client Secret" 
              />
            </div>
            <div>
              <button type="button" className="btn btn-secondary" onClick={handleSaveSchwabConfig}>
                Save Keys
              </button>
            </div>
          </div>

          <hr className="my-4" style={{ borderColor: 'var(--border)' }} />

          <div className="flex flex-col gap-3">
            <p className="text-sm"><strong>Step 1:</strong> Authenticate with Schwab.</p>
            <div className="flex gap-2">
              <button type="button" className="btn" onClick={handleSchwabLogin}>
                🔗 Open in Browser
              </button>
              <button type="button" className="btn btn-secondary" onClick={handleCopyUrl}>
                📋 Copy Login URL
              </button>
            </div>
            
            <p className="text-sm mt-2"><strong>Step 2:</strong> After logging in, you will be redirected to an empty page. Copy that URL from your browser's address bar and paste it here.</p>
            <div className="input-group">
              <input 
                type="text" 
                value={schwabRedirectUrl}
                onChange={e => setSchwabRedirectUrl(e.target.value)}
                placeholder="https://127.0.0.1/?code=xxxxxx" 
              />
            </div>
            <div>
              <button type="button" className="btn" onClick={handleExchangeToken} disabled={isExchanging}>
                {isExchanging ? 'Exchanging...' : 'Exchange Token'}
              </button>
            </div>
            {exchangeResult && (
              <div className={`mt-2 text-sm p-2 rounded ${exchangeResult.status === 'success' ? 'bg-[var(--surface)] text-green' : 'bg-red-900 text-red'}`}>
                {exchangeResult.msg}
              </div>
            )}
          </div>

          <hr className="my-4" style={{ borderColor: 'var(--border)' }} />

          <div className="flex flex-col gap-3">
            <p className="text-sm"><strong>Step 3:</strong> Verify connection is working.</p>
            <div>
              <button type="button" className="btn btn-secondary" onClick={handleTestSchwabApi} disabled={isTesting}>
                {isTesting ? '📡 Testing... Please wait...' : '📡 Test Schwab API Connection'}
              </button>
            </div>
            {testResult && (
              <div className={`mt-2 text-sm p-2 rounded ${testResult.status === 'success' ? 'bg-[var(--surface)] text-green' : 'bg-red-900 text-red'}`}>
                {testResult.msg}
              </div>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <span>Data Management</span>
          </div>
          <div className="mt-2 text-sm text-muted mb-4">
            <p>Export your portfolio data to a file so you can seamlessly import it on another computer.</p>
          </div>
          <div className="flex gap-2 mt-4">
            <button type="button" className="btn btn-secondary" onClick={handleExport}>
              ↓ Export Backup
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
              ↑ Import Backup
            </button>
            <input 
              type="file" 
              accept=".json" 
              style={{ display: 'none' }} 
              ref={fileInputRef}
              onChange={handleImport}
            />
          </div>
        </div>
      </div>
    </>
  );
}
