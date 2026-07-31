import httpx
from typing import Dict, Any, Optional

SCHWAB_API_BASE = "https://api.schwabapi.com"

class SchwabService:
    @staticmethod
    def get_authorization_url(app_key: str, redirect_uri: str) -> str:
        return f"{SCHWAB_API_BASE}/v1/oauth/authorize?response_type=code&client_id={app_key}&redirect_uri={redirect_uri}"

    @staticmethod
    async def exchange_code_for_token(app_key: str, app_secret: str, code: str, redirect_uri: str) -> Dict[str, Any]:
        url = f"{SCHWAB_API_BASE}/v1/oauth/token"
        headers = {"Content-Type": "application/x-www-form-urlencoded"}
        data = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
            "client_id": app_key,
            "client_secret": app_secret,
        }
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, headers=headers, data=data)
            if resp.status_code != 200:
                raise Exception(f"Schwab Token Exchange Error {resp.status_code}: {resp.text}")
            return resp.json()

    @staticmethod
    async def fetch_option_chain(ticker: str, access_token: str) -> Dict[str, Any]:
        url = f"{SCHWAB_API_BASE}/marketdata/v1/chains"
        headers = {"Authorization": f"Bearer {access_token}"}
        params = {"symbol": ticker, "contractType": "ALL"}
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=headers, params=params)
            if resp.status_code != 200:
                raise Exception(f"Schwab Market API Error {resp.status_code}: {resp.text}")
            return resp.json()
