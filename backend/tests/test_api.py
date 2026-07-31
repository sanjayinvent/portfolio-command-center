import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["version"] == "2.0"

def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    assert "message" in response.json()

def test_holdings_endpoints():
    # Fetch holdings
    response = client.get("/api/v1/holdings")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

    # Create holding
    payload = {
        "ticker": "TESTTICKER",
        "name": "Test Company",
        "asset_type": "stock",
        "shares": 100.0,
        "cost_basis": 150.0,
        "market_price": 160.0
    }
    create_res = client.post("/api/v1/holdings", json=payload)
    assert create_res.status_code == 200
    data = create_res.json()
    assert data["ticker"] == "TESTTICKER"
    assert data["shares"] == 100.0

def test_simulate_strategy_endpoint():
    response = client.post("/api/v1/options/simulate?ticker=AAPL&cost_basis=150.0&shares=100")
    assert response.status_code == 200
    data = response.json()
    assert data["ticker"] == "AAPL"
    assert "current_price" in data
