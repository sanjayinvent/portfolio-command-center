CACHE_TTL_SEC = 60
_CACHE: Dict[str, Dict[str, Any]] = {}

class YahooFinanceService:
    def __init__(self):
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }

    async def fetch_option_chain(self, ticker: str, target_dte: int = 31) -> Dict[str, Any]:
        now_sec = int(time.time())
        cache_key = ticker.upper()

        # 1. Return cached response if fresh (within TTL)
        if cache_key in _CACHE:
            cached_entry = _CACHE[cache_key]
            if now_sec - cached_entry["timestamp"] < CACHE_TTL_SEC:
                return cached_entry["data"]

        try:
            async with httpx.AsyncClient(headers=self.headers, follow_redirects=True) as client:
                # 1. Establish cookie session
                try:
                    await client.get("https://fc.yahoo.com")
                except Exception as e:
                    print("Cookie session fetch warning:", e)

                # 2. Retrieve crumb token
                crumb = ""
                try:
                    crumb_resp = await client.get("https://query2.finance.yahoo.com/v1/test/getcrumb")
                    if crumb_resp.status_code == 200:
                        crumb = crumb_resp.text.strip()
                except Exception as e:
                    print("Crumb fetch warning:", e)

                # 3. Initial option request
                base_url = f"https://query2.finance.yahoo.com/v7/finance/options/{ticker}"
                params = {"crumb": crumb} if crumb else {}
                
                resp = await client.get(base_url, params=params)
                
                if resp.status_code == 429:
                    print(f"Yahoo 429 Rate Limit hit for {ticker}, falling back to cache or math model...")
                    return self._fallback_response(ticker, cache_key, "Yahoo API (Cached / Math Model Fallback — Rate Limited)")

                if resp.status_code != 200:
                    return self._fallback_response(ticker, cache_key, f"Yahoo API Error {resp.status_code}")

                data = resp.json()
                res = data.get("optionChain", {}).get("result", [{}])[0]
                
                target_sec = now_sec + target_dte * 86400
                exp_dates = res.get("expirationDates", [])
                if exp_dates:
                    best_exp = min(exp_dates, key=lambda x: abs(x - target_sec))
                    params["date"] = best_exp
                    exp_resp = await client.get(base_url, params=params)
                    if exp_resp.status_code == 200:
                        res = exp_resp.json().get("optionChain", {}).get("result", [{}])[0]

                parsed_data = self._parse_chain_response(res, now_sec)
                
                # Update Cache
                _CACHE[cache_key] = {
                    "timestamp": now_sec,
                    "data": parsed_data
                }
                return parsed_data

        except Exception as err:
            print(f"Yahoo fetch error: {err}")
            return self._fallback_response(ticker, cache_key, "Mathematical Model (Fallback)")

    def _fallback_response(self, ticker: str, cache_key: str, reason: str) -> Dict[str, Any]:
        if cache_key in _CACHE:
            data = _CACHE[cache_key]["data"].copy()
            data["data_source"] = f"{data['data_source']} (Cached)"
            return data

        # Math fallback spot prices
        spot_prices = {"SPY": 542.80, "QQQ": 475.20, "AAPL": 225.50, "NVDA": 118.40, "AMZN": 182.00, "MSFT": 425.00}
        spot = spot_prices.get(ticker.upper(), 100.0)
        now_sec = int(time.time())

        # Generate math options chain
        options = []
        for pct in [1, 2, 3, 5, 7, 10, 12, 15, 20]:
            call_strike = round(spot * (1 + pct / 100.0), 2)
            put_strike = round(spot * (1 - pct / 100.0), 2)
            call_bid = max(0.50, (spot * 0.035) * (1 - pct * 0.04))
            put_bid = max(0.50, (spot * 0.030) * (1 - pct * 0.04))
            options.append({"type": "call", "strike": call_strike, "dte": 31, "bid": call_bid, "ask": call_bid * 1.05, "last": call_bid})
            options.append({"type": "put", "strike": put_strike, "dte": 31, "bid": put_bid, "ask": put_bid * 1.05, "last": put_bid})

        return {
            "spot_price": spot,
            "data_source": f"Internal Mathematical Model ({reason})",
            "options": options
        }

    def _parse_chain_response(self, res: Dict[str, Any], now_sec: int) -> Dict[str, Any]:
        quote = res.get("quote", {})
        spot_price = quote.get("regularMarketPrice", 0.0)
        options_arr = res.get("options", [{}])[0]
        
        parsed_options = []
        
        for c in options_arr.get("calls", []):
            exp_sec = c.get("expiration", now_sec)
            dte = max(1, round((exp_sec - now_sec) / 86400))
            bid = c.get("bid", 0.0)
            ask = c.get("ask", 0.0)
            last = c.get("lastPrice", 0.0)
            
            effective_bid = bid if (bid and bid > 0.05) else (last or bid or 0.0)
            effective_ask = ask if (ask and ask > 0.05) else (last or ask or 0.0)
            
            parsed_options.append({
                "type": "call",
                "strike": c.get("strike", 0.0),
                "dte": dte,
                "bid": effective_bid,
                "ask": effective_ask,
                "last": last
            })

        for p in options_arr.get("puts", []):
            exp_sec = p.get("expiration", now_sec)
            dte = max(1, round((exp_sec - now_sec) / 86400))
            bid = p.get("bid", 0.0)
            ask = p.get("ask", 0.0)
            last = p.get("lastPrice", 0.0)
            
            effective_bid = bid if (bid and bid > 0.05) else (last or bid or 0.0)
            effective_ask = ask if (ask and ask > 0.05) else (last or ask or 0.0)
            
            parsed_options.append({
                "type": "put",
                "strike": p.get("strike", 0.0),
                "dte": dte,
                "bid": effective_bid,
                "ask": effective_ask,
                "last": last
            })

        return {
            "spot_price": spot_price,
            "data_source": "Yahoo Finance API (Python — 31 DTE Chain)",
            "options": parsed_options
        }
