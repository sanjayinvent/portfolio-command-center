from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

from app.database import get_db
from app.models.schema import Holding, OptionContract, ApiConfig
from app.services.yahoo import YahooFinanceService
from app.services.schwab import SchwabService
from app.services.options_engine import OptionsStrategyEngine

router = APIRouter(prefix="/api/v1")
yahoo_service = YahooFinanceService()

# ─── Pydantic Schemas ────────────────────────────────────────────────────────

class HoldingCreate(BaseModel):
    ticker: str
    name: Optional[str] = None
    asset_type: str = "stock"
    shares: float = 0.0
    cost_basis: float = 0.0
    market_price: float = 0.0
    is_tax_loss_reserve: bool = False
    call_yield_estimate: float = 0.0
    contracts_desc: Optional[str] = None
    rate_per_lot: float = 0.0
    notes: Optional[str] = None

class HoldingPriceUpdate(BaseModel):
    ticker: str
    price: float

class OptionContractCreate(BaseModel):
    holding_id: Optional[int] = None
    symbol: str
    option_type: str = "call"
    strike: float
    expiration_date: str
    quantity: float = 1.0
    cost_basis: float = 0.0
    current_price: float = 0.0

class ApiConfigCreate(BaseModel):
    provider: str
    app_key: Optional[str] = None
    app_secret: Optional[str] = None
    oauth_token: Optional[str] = None
    oauth_refresh_token: Optional[str] = None
    token_expiry: Optional[str] = None

# ─── System & Health Endpoints ───────────────────────────────────────────────

@router.get("/health")
def health_check():
    return {"status": "ok", "service": "Portfolio Command Center FastAPI", "version": "2.0"}

# ─── Holdings Endpoints ───────────────────────────────────────────────────────

@router.get("/holdings")
def get_holdings(db: Session = Depends(get_db)):
    holdings = db.query(Holding).all()
    # Normalize field names for React frontend compatibility (ticker, avg_cost_basis, current_price)
    result = []
    for h in holdings:
        result.append({
            "id": h.id,
            "ticker": h.symbol,
            "name": h.name or h.symbol,
            "asset_type": h.asset_type,
            "shares": h.shares,
            "avg_cost_basis": h.cost_basis,
            "current_price": h.market_price,
            "cost_basis": h.cost_basis,
            "market_price": h.market_price,
            "created_at": str(h.created_at) if h.created_at else None
        })
    return result

@router.post("/holdings")
def create_or_update_holding(data: HoldingCreate, db: Session = Depends(get_db)):
    ticker_upper = data.ticker.upper()
    holding = db.query(Holding).filter(Holding.symbol == ticker_upper).first()
    if not holding:
        holding = Holding(
            symbol=ticker_upper,
            name=data.name or ticker_upper,
            asset_type=data.asset_type,
            shares=data.shares,
            cost_basis=data.cost_basis,
            market_price=data.market_price
        )
        db.add(holding)
    else:
        if data.name:
            holding.name = data.name
        holding.asset_type = data.asset_type
        holding.shares = data.shares
        holding.cost_basis = data.cost_basis
        holding.market_price = data.market_price

    db.commit()
    db.refresh(holding)
    return {
        "id": holding.id,
        "ticker": holding.symbol,
        "name": holding.name,
        "asset_type": holding.asset_type,
        "shares": holding.shares,
        "avg_cost_basis": holding.cost_basis,
        "current_price": holding.market_price
    }

@router.post("/holdings/prices")
def update_holding_prices(updates: List[HoldingPriceUpdate], db: Session = Depends(get_db)):
    for u in updates:
        holding = db.query(Holding).filter(Holding.symbol == u.ticker.upper()).first()
        if holding:
            holding.market_price = u.price
    db.commit()
    return {"status": "success", "updated_count": len(updates)}

@router.post("/holdings/restore")
def restore_holdings(holdings: List[HoldingCreate], db: Session = Depends(get_db)):
    db.query(Holding).delete()
    for item in holdings:
        ticker_upper = item.ticker.upper()
        h = Holding(
            symbol=ticker_upper,
            name=item.name or ticker_upper,
            asset_type=item.asset_type,
            shares=item.shares,
            cost_basis=item.cost_basis,
            market_price=item.market_price
        )
        db.add(h)
    db.commit()
    return {"status": "success", "count": len(holdings)}

@router.delete("/holdings/{symbol}")
def delete_holding(symbol: str, db: Session = Depends(get_db)):
    holding = db.query(Holding).filter(Holding.symbol == symbol.upper()).first()
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found")
    db.delete(holding)
    db.commit()
    return {"status": "deleted", "symbol": symbol.upper()}

# ─── Option Contracts Endpoints ──────────────────────────────────────────────

@router.get("/option_contracts")
def get_option_contracts(db: Session = Depends(get_db)):
    contracts = db.query(OptionContract).all()
    return contracts

@router.post("/option_contracts")
def create_option_contract(data: OptionContractCreate, db: Session = Depends(get_db)):
    contract = OptionContract(
        holding_id=data.holding_id,
        symbol=data.symbol,
        option_type=data.option_type,
        strike=data.strike,
        expiration_date=data.expiration_date,
        quantity=data.quantity,
        cost_basis=data.cost_basis,
        current_price=data.current_price
    )
    db.add(contract)
    db.commit()
    db.refresh(contract)
    return contract

# ─── API Config Endpoints ────────────────────────────────────────────────────

@router.get("/config/{provider}")
def get_api_config(provider: str, db: Session = Depends(get_db)):
    config = db.query(ApiConfig).filter(ApiConfig.provider == provider.lower()).first()
    if not config:
        return {"provider": provider, "app_key": None, "is_active": False}
    return {
        "provider": config.provider,
        "api_key": config.app_key,
        "app_key": config.app_key,
        "oauth_token": config.oauth_token,
        "oauth_refresh_token": config.oauth_refresh_token,
        "token_expiry": str(config.token_expiry) if config.token_expiry else None,
        "is_active": True
    }

@router.post("/config")
def save_api_config(data: ApiConfigCreate, db: Session = Depends(get_db)):
    config = db.query(ApiConfig).filter(ApiConfig.provider == data.provider.lower()).first()
    if not config:
        config = ApiConfig(
            provider=data.provider.lower(),
            app_key=data.app_key,
            app_secret=data.app_secret,
            oauth_token=data.oauth_token,
            oauth_refresh_token=data.oauth_refresh_token
        )
        db.add(config)
    else:
        config.app_key = data.app_key
        config.app_secret = data.app_secret
        config.oauth_token = data.oauth_token
        config.oauth_refresh_token = data.oauth_refresh_token
    db.commit()
    return {"status": "saved", "provider": data.provider}

# ─── Quotes & Market Data Endpoints ───────────────────────────────────────────

@router.get("/quote/{ticker}")
async def get_quote(ticker: str):
    try:
        chain_data = await yahoo_service.fetch_option_chain(ticker)
        spot_price = chain_data.get("spot_price", 0.0)
        return {"ticker": ticker.upper(), "c": spot_price, "price": spot_price}
    except Exception as e:
        return {"ticker": ticker.upper(), "c": 100.0, "price": 100.0, "error": str(e)}

# ─── Options & Strategy Endpoints ──────────────────────────────────────────────

@router.get("/options/chain/{ticker}")
async def get_option_chain(ticker: str):
    try:
        data = await yahoo_service.fetch_option_chain(ticker)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/options/simulate")
async def simulate_strategy(
    ticker: str,
    cost_basis: float = Query(..., description="Cost basis per share"),
    shares: float = Query(100.0, description="Shares owned"),
    cc_strike_pct: float = Query(5.0),
    collar_call_pct: float = Query(5.0),
    collar_put_pct: float = Query(5.0),
    csp_strike_pct: float = Query(5.0),
):
    try:
        chain_data = await yahoo_service.fetch_option_chain(ticker)
        spot_price = chain_data.get("spot_price", 100.0)
        options = chain_data.get("options", [])
        
        result = OptionsStrategyEngine.calculate_strategy(
            current_price=spot_price,
            cost_basis=cost_basis,
            shares=shares,
            cc_strike_pct=cc_strike_pct,
            collar_call_pct=collar_call_pct,
            collar_put_pct=collar_put_pct,
            csp_strike_pct=csp_strike_pct,
            options_chain=options
        )
        result["ticker"] = ticker.upper()
        result["data_source"] = chain_data.get("data_source")
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
