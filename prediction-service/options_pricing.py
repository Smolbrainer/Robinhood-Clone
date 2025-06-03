import numpy as np
import pandas as pd
import yfinance as yf
from scipy.stats import norm
from scipy.optimize import brentq
import math
from datetime import datetime, timedelta
import warnings
warnings.filterwarnings('ignore')

class OptionsPricingEngine:
    def __init__(self):
        self.risk_free_rate = 0.05  # 5% risk-free rate (10-year Treasury)
    
    def safe_float(self, value, default=0.0):
        """Safely convert value to float, handling NaN and None"""
        if value is None or pd.isna(value) or np.isnan(float(value)) if isinstance(value, (int, float)) else False:
            return default
        try:
            return float(value)
        except (ValueError, TypeError):
            return default
    
    def safe_int(self, value, default=0):
        """Safely convert value to int, handling NaN and None"""
        if value is None or pd.isna(value) or (isinstance(value, float) and np.isnan(value)):
            return default
        try:
            return int(value)
        except (ValueError, TypeError):
            return default
    
    def black_scholes_call(self, S, K, T, r, sigma):
        """
        Calculate Black-Scholes call option price
        S: Current stock price
        K: Strike price
        T: Time to expiration (years)
        r: Risk-free rate
        sigma: Volatility
        """
        if T <= 0:
            return max(S - K, 0)
        
        d1 = (np.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * np.sqrt(T))
        d2 = d1 - sigma * np.sqrt(T)
        
        call_price = S * norm.cdf(d1) - K * np.exp(-r * T) * norm.cdf(d2)
        return max(call_price, 0)
    
    def black_scholes_put(self, S, K, T, r, sigma):
        """Calculate Black-Scholes put option price"""
        if T <= 0:
            return max(K - S, 0)
        
        d1 = (np.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * np.sqrt(T))
        d2 = d1 - sigma * np.sqrt(T)
        
        put_price = K * np.exp(-r * T) * norm.cdf(-d2) - S * norm.cdf(-d1)
        return max(put_price, 0)
    
    def calculate_greeks(self, S, K, T, r, sigma, option_type='call'):
        """Calculate all Greeks for an option"""
        if T <= 0:
            return {
                'delta': 1.0 if option_type == 'call' and S > K else 0.0,
                'gamma': 0.0, 'theta': 0.0, 'vega': 0.0, 'rho': 0.0
            }
        
        d1 = (np.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * np.sqrt(T))
        d2 = d1 - sigma * np.sqrt(T)
        
        # Delta
        if option_type == 'call':
            delta = norm.cdf(d1)
        else:
            delta = norm.cdf(d1) - 1
        
        # Gamma (same for calls and puts)
        gamma = norm.pdf(d1) / (S * sigma * np.sqrt(T))
        
        # Theta
        common_theta = -(S * norm.pdf(d1) * sigma) / (2 * np.sqrt(T))
        if option_type == 'call':
            theta = (common_theta - r * K * np.exp(-r * T) * norm.cdf(d2)) / 365
        else:
            theta = (common_theta + r * K * np.exp(-r * T) * norm.cdf(-d2)) / 365
        
        # Vega (same for calls and puts)
        vega = S * norm.pdf(d1) * np.sqrt(T) / 100
        
        # Rho
        if option_type == 'call':
            rho = K * T * np.exp(-r * T) * norm.cdf(d2) / 100
        else:
            rho = -K * T * np.exp(-r * T) * norm.cdf(-d2) / 100
        
        return {
            'delta': round(delta, 4),
            'gamma': round(gamma, 4),
            'theta': round(theta, 4),
            'vega': round(vega, 4),
            'rho': round(rho, 4)
        }
    
    def implied_volatility(self, market_price, S, K, T, r, option_type='call'):
        """Calculate implied volatility using Brent's method"""
        if T <= 0:
            return 0.0
        
        def objective_function(sigma):
            if option_type == 'call':
                theoretical_price = self.black_scholes_call(S, K, T, r, sigma)
            else:
                theoretical_price = self.black_scholes_put(S, K, T, r, sigma)
            return theoretical_price - market_price
        
        try:
            iv = brentq(objective_function, 0.001, 5.0, xtol=1e-6, maxiter=100)
            return round(iv, 4)
        except (ValueError, RuntimeError):
            return 0.20  # Default 20% volatility if calculation fails
    
    def get_yahoo_options_data(self, symbol):
        """Fetch options data from Yahoo Finance"""
        try:
            ticker = yf.Ticker(symbol)
            stock_info = ticker.info
            current_price = stock_info.get('currentPrice', stock_info.get('regularMarketPrice', 100))
            
            # Get options expiration dates
            exp_dates = ticker.options
            if not exp_dates:
                return None
            
            options_data = {
                'symbol': symbol,
                'currentPrice': current_price,
                'expirationDates': list(exp_dates),
                'chains': {}
            }
            
            # Get options chains for each expiration
            for exp_date in exp_dates[:6]:  # Limit to first 6 expirations
                try:
                    opt_chain = ticker.option_chain(exp_date)
                    calls_df = opt_chain.calls
                    puts_df = opt_chain.puts
                    
                    # Calculate time to expiration
                    exp_datetime = datetime.strptime(exp_date, '%Y-%m-%d')
                    time_to_exp = (exp_datetime - datetime.now()).days / 365.0
                    
                    # Process calls
                    calls_processed = []
                    for _, call in calls_df.iterrows():
                        strike = call['strike']
                        last_price = call.get('lastPrice', 0)
                        bid = call.get('bid', 0)
                        ask = call.get('ask', 0)
                        volume = call.get('volume', 0)
                        open_interest = call.get('openInterest', 0)
                        
                        # Calculate theoretical price and Greeks
                        if last_price > 0 and time_to_exp > 0:
                            iv = self.implied_volatility(last_price, current_price, strike, time_to_exp, self.risk_free_rate, 'call')
                            theoretical_price = self.black_scholes_call(current_price, strike, time_to_exp, self.risk_free_rate, iv)
                            greeks = self.calculate_greeks(current_price, strike, time_to_exp, self.risk_free_rate, iv, 'call')
                        else:
                            iv = 0.20
                            theoretical_price = 0
                            greeks = {'delta': 0, 'gamma': 0, 'theta': 0, 'vega': 0, 'rho': 0}
                        
                        calls_processed.append({
                            'strike': self.safe_float(strike),
                            'lastPrice': self.safe_float(last_price),
                            'bid': self.safe_float(bid),
                            'ask': self.safe_float(ask),
                            'volume': self.safe_int(volume),
                            'openInterest': self.safe_int(open_interest),
                            'impliedVolatility': self.safe_float(iv),
                            'theoreticalPrice': round(self.safe_float(theoretical_price), 2),
                            'delta': self.safe_float(greeks['delta']),
                            'gamma': self.safe_float(greeks['gamma']),
                            'theta': self.safe_float(greeks['theta']),
                            'vega': self.safe_float(greeks['vega']),
                            'rho': self.safe_float(greeks['rho']),
                            'inTheMoney': current_price > strike
                        })
                    
                    # Process puts
                    puts_processed = []
                    for _, put in puts_df.iterrows():
                        strike = put['strike']
                        last_price = put.get('lastPrice', 0)
                        bid = put.get('bid', 0)
                        ask = put.get('ask', 0)
                        volume = put.get('volume', 0)
                        open_interest = put.get('openInterest', 0)
                        
                        # Calculate theoretical price and Greeks
                        if last_price > 0 and time_to_exp > 0:
                            iv = self.implied_volatility(last_price, current_price, strike, time_to_exp, self.risk_free_rate, 'put')
                            theoretical_price = self.black_scholes_put(current_price, strike, time_to_exp, self.risk_free_rate, iv)
                            greeks = self.calculate_greeks(current_price, strike, time_to_exp, self.risk_free_rate, iv, 'put')
                        else:
                            iv = 0.20
                            theoretical_price = 0
                            greeks = {'delta': 0, 'gamma': 0, 'theta': 0, 'vega': 0, 'rho': 0}
                        
                        puts_processed.append({
                            'strike': self.safe_float(strike),
                            'lastPrice': self.safe_float(last_price),
                            'bid': self.safe_float(bid),
                            'ask': self.safe_float(ask),
                            'volume': self.safe_int(volume),
                            'openInterest': self.safe_int(open_interest),
                            'impliedVolatility': self.safe_float(iv),
                            'theoreticalPrice': round(self.safe_float(theoretical_price), 2),
                            'delta': self.safe_float(greeks['delta']),
                            'gamma': self.safe_float(greeks['gamma']),
                            'theta': self.safe_float(greeks['theta']),
                            'vega': self.safe_float(greeks['vega']),
                            'rho': self.safe_float(greeks['rho']),
                            'inTheMoney': current_price < strike
                        })
                    
                    options_data['chains'][exp_date] = {
                        'calls': sorted(calls_processed, key=lambda x: x['strike']),
                        'puts': sorted(puts_processed, key=lambda x: x['strike']),
                        'timeToExpiration': time_to_exp
                    }
                    
                except Exception as e:
                    print(f"Error processing expiration {exp_date}: {e}")
                    continue
            
            return options_data
            
        except Exception as e:
            print(f"Error fetching options data for {symbol}: {e}")
            return None
    
    def calculate_strategy_payoff(self, strategy_legs, spot_prices):
        """Calculate payoff for an options strategy"""
        payoffs = []
        
        for spot in spot_prices:
            total_payoff = 0
            
            for leg in strategy_legs:
                action = leg['action']  # 'buy' or 'sell'
                option_type = leg['type']  # 'call' or 'put'
                strike = leg['strike']
                premium = leg['premium']
                contracts = leg.get('contracts', 1)
                
                # Calculate intrinsic value at expiration
                if option_type == 'call':
                    intrinsic_value = max(spot - strike, 0)
                else:  # put
                    intrinsic_value = max(strike - spot, 0)
                
                # Calculate P&L for this leg
                if action == 'buy':
                    leg_payoff = (intrinsic_value - premium) * contracts * 100
                else:  # sell
                    leg_payoff = (premium - intrinsic_value) * contracts * 100
                
                total_payoff += leg_payoff
            
            payoffs.append(total_payoff)
        
        return payoffs
    
    def analyze_strategy(self, strategy_legs, current_price):
        """Analyze an options strategy"""
        # Calculate spot price range for analysis
        spot_range = np.linspace(current_price * 0.7, current_price * 1.3, 100)
        payoffs = self.calculate_strategy_payoff(strategy_legs, spot_range)
        
        # Find max profit, max loss, and breakeven points
        max_profit = max(payoffs)
        max_loss = min(payoffs)
        
        # Find breakeven points (where payoff crosses zero)
        breakevens = []
        for i in range(len(payoffs) - 1):
            if (payoffs[i] <= 0 and payoffs[i + 1] > 0) or (payoffs[i] >= 0 and payoffs[i + 1] < 0):
                # Linear interpolation to find exact breakeven
                breakeven = spot_range[i] + (spot_range[i + 1] - spot_range[i]) * (-payoffs[i] / (payoffs[i + 1] - payoffs[i]))
                breakevens.append(round(breakeven, 2))
        
        # Calculate net premium
        net_premium = sum(leg['premium'] * leg.get('contracts', 1) * (1 if leg['action'] == 'sell' else -1) for leg in strategy_legs)
        
        return {
            'maxProfit': round(max_profit, 2) if max_profit < float('inf') else 'Unlimited',
            'maxLoss': round(max_loss, 2) if max_loss > float('-inf') else 'Unlimited',
            'breakevens': breakevens,
            'netPremium': round(net_premium, 2),
            'spotRange': spot_range.tolist(),
            'payoffs': payoffs
        }

# Predefined strategy templates
STRATEGY_TEMPLATES = {
    'long_call': {
        'name': 'Long Call',
        'description': 'Bullish strategy with unlimited upside potential',
        'legs': [{'action': 'buy', 'type': 'call', 'strike': None, 'premium': None, 'contracts': 1}]
    },
    'long_put': {
        'name': 'Long Put',
        'description': 'Bearish strategy with limited risk',
        'legs': [{'action': 'buy', 'type': 'put', 'strike': None, 'premium': None, 'contracts': 1}]
    },
    'covered_call': {
        'name': 'Covered Call',
        'description': 'Generate income from stock holdings',
        'legs': [
            {'action': 'sell', 'type': 'call', 'strike': None, 'premium': None, 'contracts': 1},
            {'action': 'hold', 'type': 'stock', 'shares': 100}
        ]
    },
    'protective_put': {
        'name': 'Protective Put',
        'description': 'Protect stock holdings from downside',
        'legs': [
            {'action': 'buy', 'type': 'put', 'strike': None, 'premium': None, 'contracts': 1},
            {'action': 'hold', 'type': 'stock', 'shares': 100}
        ]
    },
    'bull_call_spread': {
        'name': 'Bull Call Spread',
        'description': 'Limited risk, limited reward bullish strategy',
        'legs': [
            {'action': 'buy', 'type': 'call', 'strike': None, 'premium': None, 'contracts': 1},
            {'action': 'sell', 'type': 'call', 'strike': None, 'premium': None, 'contracts': 1}
        ]
    },
    'bear_put_spread': {
        'name': 'Bear Put Spread',
        'description': 'Limited risk, limited reward bearish strategy',
        'legs': [
            {'action': 'buy', 'type': 'put', 'strike': None, 'premium': None, 'contracts': 1},
            {'action': 'sell', 'type': 'put', 'strike': None, 'premium': None, 'contracts': 1}
        ]
    },
    'long_straddle': {
        'name': 'Long Straddle',
        'description': 'Profit from high volatility in either direction',
        'legs': [
            {'action': 'buy', 'type': 'call', 'strike': None, 'premium': None, 'contracts': 1},
            {'action': 'buy', 'type': 'put', 'strike': None, 'premium': None, 'contracts': 1}
        ]
    },
    'iron_condor': {
        'name': 'Iron Condor',
        'description': 'Profit from low volatility with limited risk',
        'legs': [
            {'action': 'sell', 'type': 'put', 'strike': None, 'premium': None, 'contracts': 1},
            {'action': 'buy', 'type': 'put', 'strike': None, 'premium': None, 'contracts': 1},
            {'action': 'sell', 'type': 'call', 'strike': None, 'premium': None, 'contracts': 1},
            {'action': 'buy', 'type': 'call', 'strike': None, 'premium': None, 'contracts': 1}
        ]
    }
} 