# Portfolio Command Center Architecture

This document outlines the architecture for the **Portfolio Command Center** native desktop application. The application provides a high-performance local dashboard to model and track a 5-year portfolio transition simulation.

## Technology Stack

- **Frontend**: React 19, TypeScript, Vite
- **Backend / Desktop Shell**: Tauri v2 (Rust)
- **Database**: Embedded SQLite (`tauri-plugin-sql`)
- **External APIs**: Finnhub (Live market quotes)

## System Architecture Diagram

```mermaid
graph TD
    subgraph Frontend [React Frontend (WebView)]
        UI[User Interface Components]
        Hooks[Custom Hooks e.g., useDatabase]
        Router[React Router]
        
        UI --> Hooks
        UI --> Router
    end

    subgraph Backend [Tauri Backend (Rust Core)]
        IPC[Tauri IPC Command Handler]
        Reqwest[Rust HTTP Client - reqwest]
        
        IPC --> Reqwest
    end

    subgraph Data Layer [Local Storage]
        SQLite[(SQLite Database\nportfolio.db)]
        KeyStore[Encrypted Secure Store]
    end

    subgraph External Services
        Finnhub[Finnhub REST API]
    end

    %% Connections
    Hooks -- "Tauri IPC (fetch_quote, etc)" --> IPC
    Hooks -- "SQL Queries (tauri-plugin-sql)" --> SQLite
    Reqwest -- "HTTPS GET" --> Finnhub
    IPC -- "Reads/Writes API Keys" --> SQLite
```

## Data Flow & IPC

1. **User Interactions**: When a user interacts with the React interface (e.g., clicking "Live Prices"), a request is initiated via React hooks.
2. **Database Queries**: Standard CRUD operations (fetching holdings, adding positions) are routed directly from the React frontend to the SQLite database via the `@tauri-apps/plugin-sql` wrapper. The rust backend handles the actual disk writing securely.
3. **API Calls**: External API calls (like fetching Finnhub prices) are **not** made directly from the browser. Instead:
   - The React app invokes a Tauri IPC command (`invoke('fetch_quotes_batch')`).
   - The Rust backend receives the command, executes the HTTP request securely using the `reqwest` crate, and parses the response.
   - The Rust backend returns the payload back to the React frontend.
   - The React frontend then updates the SQLite database with the new values.

## Database Schema (SQLite)

The application relies on a single-file SQLite database (`portfolio.db`) managed entirely locally. The primary tables include:

| Table Name | Description |
|---|---|
| `holdings` | Core portfolio positions (Stocks and ETFs). Tracks shares, cost basis, current prices, and options strategies (e.g. Tax Loss Reserve, Call Yields). |
| `option_contracts` | Tracks individual active and historical covered calls and puts. |
| `transactions` | Ledger of executed buys, sells, dividends, and option premiums. |
| `cash_flows` | Monthly inflow/outflow tracking, including fresh cash deployment and estimated taxes. |
| `api_config` | Secure local storage for external provider keys (e.g., Finnhub API Key) and activation status. |
| `simulation_scenarios` | Stores configuration parameters for 5-year modeling (growth rates, tax rates, deployment amounts). |

## Security Model
- **No Cloud Backend**: All user data, holdings, and simulation results live exclusively on the user's local file system.
- **API Key Protection**: API keys are saved locally in the `api_config` SQLite table and are only utilized by the Rust backend. They are never exposed in standard web network requests where CORS or interception might be a risk.
