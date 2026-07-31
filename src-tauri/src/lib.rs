use serde::{Deserialize, Serialize};
use tauri::Manager;

// ─── Data Types ─────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Holding {
    pub id: Option<i64>,
    pub ticker: String,
    pub asset_type: String,
    pub shares: f64,
    pub avg_cost_basis: f64,
    pub current_price: Option<f64>,
    pub is_tax_loss_reserve: bool,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FinnhubQuote {
    pub c: f64,  // Current price
    pub d: f64,  // Change
    pub dp: f64, // Percent change
    pub h: f64,  // High price of the day
    pub l: f64,  // Low price of the day
    pub o: f64,  // Open price
    pub pc: f64, // Previous close
    pub t: i64,  // Timestamp
}

// ─── Tauri Commands ─────────────────────────────────────────────────────────

#[tauri::command]
async fn fetch_quote(ticker: String, api_key: String) -> Result<FinnhubQuote, String> {
    let url = format!(
        "https://finnhub.io/api/v1/quote?symbol={}&token={}",
        ticker, api_key
    );
    let resp = reqwest::get(&url)
        .await
        .map_err(|e| format!("Network error: {}", e))?;
    let quote: FinnhubQuote = resp
        .json()
        .await
        .map_err(|e| format!("Parse error: {}", e))?;
    Ok(quote)
}

#[tauri::command]
async fn fetch_quotes_batch(
    tickers: Vec<String>,
    api_key: String,
) -> Result<Vec<(String, FinnhubQuote)>, String> {
    let mut results = Vec::new();
    for ticker in tickers {
        let url = format!(
            "https://finnhub.io/api/v1/quote?symbol={}&token={}",
            ticker, api_key
        );
        match reqwest::get(&url).await {
            Ok(resp) => match resp.json::<FinnhubQuote>().await {
                Ok(quote) => results.push((ticker, quote)),
                Err(e) => eprintln!("Parse error for {}: {}", ticker, e),
            },
            Err(e) => eprintln!("Network error for {}: {}", ticker, e),
        }
    }
    Ok(results)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SchwabTokenResponse {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_in: i32,
    pub refresh_token_expires_in: Option<i32>,
    pub token_type: Option<String>,
}

#[tauri::command]
async fn schwab_exchange_token(
    client_id: String,
    client_secret: String,
    auth_code: String,
) -> Result<SchwabTokenResponse, String> {
    let client = reqwest::Client::new();
    
    // Schwab requires Basic auth and URL encoded body
    let params = [
        ("grant_type", "authorization_code"),
        ("code", &auth_code),
        ("redirect_uri", "https://127.0.0.1"),
    ];

    let resp = client
        .post("https://api.schwabapi.com/v1/oauth/token")
        .basic_auth(&client_id, Some(&client_secret))
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    let status = resp.status();
    let text = resp.text().await.map_err(|e| format!("Error reading body: {}", e))?;
    
    if !status.is_success() {
        return Err(format!("Schwab API Error {}: {}", status, text));
    }

    let token_resp: SchwabTokenResponse = serde_json::from_str(&text)
        .map_err(|e| format!("Parse error: {}", e))?;

    Ok(token_resp)
}

#[tauri::command]
async fn fetch_schwab_option_chain(
    ticker: String,
    access_token: String,
) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let url = format!("https://api.schwabapi.com/marketdata/v1/chains?symbol={}", ticker);
    
    let resp = client
        .get(&url)
        .bearer_auth(&access_token)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    let status = resp.status();
    let text = resp.text().await.map_err(|e| format!("Error reading body: {}", e))?;

    if !status.is_success() {
        return Err(format!("Schwab Option API Error {}: {}", status, text));
    }

    let json_resp: serde_json::Value = serde_json::from_str(&text)
        .map_err(|e| format!("Parse error: {}", e))?;

    Ok(json_resp)
}

#[tauri::command]
async fn fetch_yahoo_option_chain(
    ticker: String,
    date: Option<i64>,
) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::builder()
        .cookie_store(true)
        .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| format!("Client build error: {}", e))?;
        
    // 1. Establish cookie session
    let _ = client.get("https://fc.yahoo.com").send().await;

    // 2. Obtain crumb token
    let crumb = match client.get("https://query2.finance.yahoo.com/v1/test/getcrumb").send().await {
        Ok(resp) => resp.text().await.unwrap_or_default(),
        Err(_) => String::new(),
    };

    // 3. Request option chain with crumb parameter and optional date
    let date_param = match date {
        Some(d) => format!("&date={}", d),
        None => String::new(),
    };

    let url = if !crumb.is_empty() {
        format!("https://query2.finance.yahoo.com/v7/finance/options/{}?crumb={}{}", ticker, crumb, date_param)
    } else {
        format!("https://query2.finance.yahoo.com/v7/finance/options/{}{}", ticker, date_param)
    };
    
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    let status = resp.status();
    let text = resp.text().await.map_err(|e| format!("Error reading body: {}", e))?;

    if !status.is_success() {
        return Err(format!("Yahoo Option API Error {}: {}", status, text));
    }

    let json_resp: serde_json::Value = serde_json::from_str(&text)
        .map_err(|e| format!("Parse error: {}", e))?;

    Ok(json_resp)
}

// ─── Database Schema ────────────────────────────────────────────────────────

const SCHEMA_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS holdings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker TEXT NOT NULL,
    asset_type TEXT NOT NULL CHECK(asset_type IN ('stock', 'etf')),
    shares REAL NOT NULL DEFAULT 0,
    avg_cost_basis REAL NOT NULL DEFAULT 0,
    current_price REAL,
    last_price_update TEXT,
    is_tax_loss_reserve INTEGER DEFAULT 0,
    call_yield_estimate REAL DEFAULT 0,
    contracts_desc TEXT,
    rate_per_lot REAL DEFAULT 0,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS option_contracts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    holding_id INTEGER NOT NULL REFERENCES holdings(id),
    contract_type TEXT NOT NULL CHECK(contract_type IN ('call', 'put')),
    strike_price REAL NOT NULL,
    expiration_date TEXT NOT NULL,
    contracts INTEGER NOT NULL DEFAULT 1,
    premium_received REAL NOT NULL DEFAULT 0,
    open_date TEXT NOT NULL,
    close_date TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'closed', 'assigned', 'expired')),
    delta REAL,
    schwab_order_id TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    holding_id INTEGER REFERENCES holdings(id),
    action TEXT NOT NULL CHECK(action IN ('buy', 'sell', 'dividend', 'option_premium', 'assignment')),
    ticker TEXT NOT NULL,
    shares REAL,
    price REAL,
    total_value REAL NOT NULL,
    funding_source TEXT,
    schwab_confirmation TEXT,
    executed_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cash_flows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    month TEXT NOT NULL,
    fresh_cash_inflow REAL NOT NULL DEFAULT 5000,
    options_income REAL NOT NULL DEFAULT 0,
    dividend_income REAL NOT NULL DEFAULT 0,
    total_deployed REAL NOT NULL DEFAULT 0,
    tax_estimate REAL NOT NULL DEFAULT 0,
    strategy_phase TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS simulation_scenarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    monthly_fresh_cash REAL DEFAULT 5000,
    growth_rate_monthly REAL DEFAULT 0.005,
    tax_rate REAL DEFAULT 0.25,
    strategy_config TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS simulation_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scenario_id INTEGER NOT NULL REFERENCES simulation_scenarios(id),
    month_index INTEGER NOT NULL,
    date_label TEXT,
    total_value REAL,
    stock_value REAL,
    etf_value REAL,
    monthly_sweep REAL,
    cumulative_swept REAL,
    tax_estimate REAL,
    holdings_snapshot TEXT,
    trades TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS api_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL UNIQUE CHECK(provider IN ('finnhub', 'schwab', 'polygon', 'alpha_vantage')),
    api_key TEXT,
    oauth_token TEXT,
    oauth_refresh_token TEXT,
    token_expiry TEXT,
    is_active INTEGER DEFAULT 0,
    last_synced TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS price_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker TEXT NOT NULL,
    price REAL NOT NULL,
    source TEXT NOT NULL,
    fetched_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS option_chain_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker TEXT NOT NULL,
    expiration_date TEXT NOT NULL,
    strike_price REAL NOT NULL,
    contract_type TEXT NOT NULL,
    bid REAL,
    ask REAL,
    last_price REAL,
    delta REAL,
    gamma REAL,
    theta REAL,
    vega REAL,
    implied_volatility REAL,
    open_interest INTEGER,
    volume INTEGER,
    fetched_at TEXT DEFAULT (datetime('now'))
);
"#;

const SEED_SQL: &str = r#"
INSERT OR IGNORE INTO holdings (id, ticker, asset_type, shares, avg_cost_basis, current_price, is_tax_loss_reserve, call_yield_estimate, contracts_desc) VALUES
    (1, 'JPM', 'stock', 154, 345.00, 345.00, 0, 340, '1x Call'),
    (2, 'NVDA', 'stock', 200, 194.00, 194.00, 0, 820, '2x Calls'),
    (3, 'AMZN', 'stock', 150, 185.00, 185.00, 0, 410, '1x Call'),
    (4, 'MSFT', 'stock', 100, 428.00, 428.00, 0, 360, '1x Call'),
    (5, 'NFLX', 'stock', 400, 72.00, 72.00, 0, 560, '4x Calls'),
    (6, 'WM', 'stock', 100, 215.00, 215.00, 0, 230, '1x Call'),
    (7, 'AEP', 'stock', 300, 96.00, 96.00, 0, 360, '3x Calls'),
    (8, 'DRAM', 'stock', 400, 53.00, 53.00, 1, 0, 'Tax Loss Reserve'),
    (9, 'SMCI', 'stock', 400, 89.40, 89.40, 1, 0, 'Tax Loss Reserve');

INSERT OR IGNORE INTO holdings (id, ticker, asset_type, shares, avg_cost_basis, current_price, is_tax_loss_reserve, rate_per_lot) VALUES
    (10, 'VOO', 'etf', 183.08, 520.00, 520.00, 0, 185),
    (11, 'DIVO', 'etf', 1666.67, 42.00, 42.00, 0, 65),
    (12, 'COWZ', 'etf', 714.29, 56.00, 56.00, 0, 55),
    (13, 'VTEB', 'etf', 363.58, 50.00, 50.00, 0, 35),
    (14, 'QQQ', 'etf', 35.00, 480.00, 480.00, 0, 170),
    (15, 'CALF', 'etf', 200.00, 42.00, 42.00, 0, 45),
    (16, 'IDVO', 'etf', 0, 36.00, 36.00, 0, 50),
    (17, 'VXUS', 'etf', 0, 62.00, 62.00, 0, 40),
    (18, 'SMH', 'etf', 0, 260.00, 260.00, 0, 120),
    (19, 'VHT', 'etf', 0, 260.00, 260.00, 0, 90);

INSERT OR IGNORE INTO api_config (provider, is_active) VALUES
    ('finnhub', 0),
    ('schwab', 0);

INSERT OR IGNORE INTO simulation_scenarios (id, name, description, monthly_fresh_cash, growth_rate_monthly, tax_rate) VALUES
    (1, 'Base Plan', '5-year transition from stocks to ETF-heavy covered call income portfolio. $5k/mo fresh cash, 0.5%/mo growth, 25% tax rate.', 5000, 0.005, 0.25);
"#;

#[tauri::command]
async fn initialize_database(app: tauri::AppHandle) -> Result<String, String> {
    use tauri_plugin_sql::{Migration, MigrationKind};

    // The database is initialized via the plugin — this command
    // runs the seed data after schema creation
    Ok("Database initialized".to_string())
}

// ─── App Entry Point ────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    use tauri_plugin_sql::{Migration, MigrationKind};

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(
                    "sqlite:portfolio.db",
                    vec![
                        Migration {
                            version: 1,
                            description: "Create initial schema",
                            sql: SCHEMA_SQL,
                            kind: MigrationKind::Up,
                        },
                        Migration {
                            version: 2,
                            description: "Seed portfolio data",
                            sql: SEED_SQL,
                            kind: MigrationKind::Up,
                        },
                    ],
                )
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            fetch_quote,
            fetch_quotes_batch,
            initialize_database,
            schwab_exchange_token,
            fetch_schwab_option_chain,
            fetch_yahoo_option_chain,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
