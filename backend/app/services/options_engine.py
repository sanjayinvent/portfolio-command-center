import math
from typing import Dict, Any, List, Optional

class OptionsStrategyEngine:
    @staticmethod
    def calculate_strategy(
        current_price: float,
        cost_basis: float,
        shares: float,
        cc_strike_pct: float = 5.0,
        collar_call_pct: float = 5.0,
        collar_put_pct: float = 5.0,
        csp_strike_pct: float = 5.0,
        options_chain: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        options_chain = options_chain or []

        # Helper to pick closest strike from live chain or mathematical fallback
        def get_strike_details(pct_offset: float, option_type: str) -> Dict[str, Any]:
            is_call = (option_type == "call")
            target_price = current_price * (1 + pct_offset / 100.0) if is_call else current_price * (1 - pct_offset / 100.0)
            
            match = None
            candidates = [o for o in options_chain if o.get("type") == option_type]
            if candidates:
                match = min(candidates, key=lambda c: abs(c.get("strike", 0.0) - target_price))

            est_bid = max(0.50, (current_price * 0.035) * (1 - pct_offset * 0.04)) if is_call else max(0.50, (current_price * 0.030) * (1 - pct_offset * 0.04))
            
            strike = match["strike"] if match else round(target_price)
            bid = match["bid"] if match else est_bid
            ask = match["ask"] if match else est_bid * 1.05
            dte = match["dte"] if match else 31
            
            return {
                "target_price": target_price,
                "strike": strike,
                "bid": bid,
                "ask": ask,
                "dte": dte
            }

        # 1. Covered Call Calculation
        cc_details = get_strike_details(cc_strike_pct, "call")
        contracts = max(1.0, math.floor(shares / 100.0)) if shares >= 100 else 1.0
        cc_premium = cc_details["bid"] * 100.0 * contracts
        cc_max_profit = ((cc_details["strike"] - current_price) * (contracts * 100.0)) + cc_premium
        cc_ann_market = ((cc_premium / (current_price * contracts * 100.0)) * (365.0 / cc_details["dte"])) * 100.0 if current_price > 0 else 0.0
        cc_ann_cost = ((cc_premium / (cost_basis * contracts * 100.0)) * (365.0 / cc_details["dte"])) * 100.0 if cost_basis > 0 else cc_ann_market

        # 2. Covered Call + Put Collar Calculation
        collar_call = get_strike_details(collar_call_pct, "call")
        collar_put = get_strike_details(collar_put_pct, "put")
        net_credit = (collar_call["bid"] - collar_put["ask"]) * 100.0 * contracts
        collar_max_profit = ((collar_call["strike"] - current_price) * contracts * 100.0) + net_credit
        collar_max_loss = ((current_price - collar_put["strike"]) * contracts * 100.0) - net_credit
        collar_ann_market = ((net_credit / (current_price * contracts * 100.0)) * (365.0 / collar_call["dte"])) * 100.0 if current_price > 0 else 0.0
        collar_ann_cost = ((net_credit / (cost_basis * contracts * 100.0)) * (365.0 / collar_call["dte"])) * 100.0 if cost_basis > 0 else collar_ann_market

        # 3. Cash Secured Put Calculation
        csp_details = get_strike_details(csp_strike_pct, "put")
        csp_premium = csp_details["bid"] * 100.0 * contracts
        capital_required = csp_details["strike"] * 100.0 * contracts
        csp_ann_return = ((csp_premium / capital_required) * (365.0 / csp_details["dte"])) * 100.0 if capital_required > 0 else 0.0

        return {
            "current_price": current_price,
            "cost_basis": cost_basis,
            "shares": shares,
            "covered_call": {
                "strike": cc_details["strike"],
                "bid": cc_details["bid"],
                "dte": cc_details["dte"],
                "premium_collected": cc_premium,
                "max_profit": cc_max_profit,
                "annualized_market_return": round(cc_ann_market, 2),
                "annualized_cost_return": round(cc_ann_cost, 2),
            },
            "collar": {
                "call_strike": collar_call["strike"],
                "call_bid": collar_call["bid"],
                "put_strike": collar_put["strike"],
                "put_ask": collar_put["ask"],
                "net_credit": net_credit,
                "max_profit": collar_max_profit,
                "max_loss": collar_max_loss,
                "annualized_market_return": round(collar_ann_market, 2),
                "annualized_cost_return": round(collar_ann_cost, 2),
            },
            "cash_secured_put": {
                "strike": csp_details["strike"],
                "bid": csp_details["bid"],
                "dte": csp_details["dte"],
                "premium_collected": csp_premium,
                "capital_required": capital_required,
                "annualized_return": round(csp_ann_return, 2),
            }
        }
