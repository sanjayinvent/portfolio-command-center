# PatelScope — Portfolio Command Center (v2.0.1)

**PatelScope** is a production-grade 3-tier local intranet web application for portfolio management, options yield optimization (Covered Calls, Put Collars, Cash Secured Puts), and 60-month transition modeling.

## System Architecture

- **Tier 1 (Presentation)**: React 19, TypeScript, Vite web application.
- **Tier 2 (Service API)**: Python 3.12 FastAPI server with Black-Scholes options pricing engine and Schwab/Yahoo data services.
- **Tier 3 (Database & Infrastructure)**: Dockerized PostgreSQL (`patelscope_db`), Redis (`patelscope_redis`), and NGINX reverse proxy (`patelscope_proxy`).

## Quick Start

### 1. Launch Backend API (Python)
```bash
cd backend
python3 -m pip install -r requirements.txt
python3 -m uvicorn app.main:app --reload --port 8000
```

### 2. Start Frontend Web Server
```bash
npm run dev
```

### 3. Open in Browser
Visit `http://localhost:1420` or `http://localhost:5173`.
