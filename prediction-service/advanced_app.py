#!/usr/bin/env python3
"""
Advanced Stock Prediction API
Uses sophisticated technical analysis with multiple indicators
More advanced than simple_app.py but doesn't require TensorFlow
"""

import os
import sys
import time
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional

import yfinance as yf
import pandas as pd
import numpy as np
from flask import Flask, jsonify, request
from flask_cors import CORS
import ta
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error
import warnings
warnings.filterwarnings('ignore')

# Try to import advanced predictor, fallback to None if TensorFlow not available
try:
    from stock_predictor import StockPredictor
    HAS_TENSORFLOW = True
except ImportError:
    print("TensorFlow not available, using simplified predictions only")
    StockPredictor = None
    HAS_TENSORFLOW = False

from options_pricing import OptionsPricingEngine, STRATEGY_TEMPLATES
import traceback

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Flask app setup
app = Flask(__name__)
CORS(app)

# Initialize components
if HAS_TENSORFLOW:
    predictor = StockPredictor('AAPL')  # Default symbol, will be changed per request
else:
    predictor = None
    
options_engine = OptionsPricingEngine()

# Cache for storing predictions and options data
prediction_cache = {}
options_cache = {}
CACHE_DURATION = 3600  # 1 hour cache

class SimpleFallbackPredictor:
    """Simple fallback predictor when TensorFlow is not available"""
    
    def simple_prediction(self, symbol):
        """Generate a simple prediction without TensorFlow"""
        try:
            # Fetch recent data
            ticker = yf.Ticker(symbol)
            data = ticker.history(period="1y")
            
            if data.empty:
                return None
                
            current_price = float(data['Close'].iloc[-1])
            
            # Calculate simple moving averages and trends
            data['SMA_50'] = data['Close'].rolling(50).mean()
            data['SMA_200'] = data['Close'].rolling(200).mean()
            data['Returns'] = data['Close'].pct_change()
            
            # Simple trend analysis
            recent_trend = data['Returns'].tail(20).mean()
            volatility = data['Returns'].tail(60).std()
            
            # Generate simple prediction (moving average trend)
            if current_price > data['SMA_50'].iloc[-1] and data['SMA_50'].iloc[-1] > data['SMA_200'].iloc[-1]:
                trend_multiplier = 1.1  # Bullish
            elif current_price < data['SMA_50'].iloc[-1] and data['SMA_50'].iloc[-1] < data['SMA_200'].iloc[-1]:
                trend_multiplier = 0.95  # Bearish
            else:
                trend_multiplier = 1.02  # Neutral
            
            # Generate simple future predictions
            predictions = []
            dates = []
            current_date = datetime.now()
            
            for i in range(365):
                # Simple price walk with trend
                days_ahead = i + 1
                trend_factor = (trend_multiplier ** (days_ahead / 365))
                noise = np.random.normal(0, volatility * 0.1)  # Small random noise
                predicted_price = current_price * trend_factor * (1 + noise)
                
                predictions.append(float(predicted_price))
                
                # Generate business day
                next_date = current_date + timedelta(days=i+1)
                if next_date.weekday() < 5:  # Monday = 0, Friday = 4
                    dates.append(next_date.strftime('%Y-%m-%d'))
                
                if len(dates) >= 365:
                    break
            
            # Calculate return metrics
            predicted_1y = predictions[-1] if predictions else current_price
            predicted_return = (predicted_1y - current_price) / current_price
            
            # Determine trend
            if predicted_return > 0.15:
                trend = "bullish"
            elif predicted_return < -0.15:
                trend = "bearish"
            else:
                trend = "neutral"
            
            return {
                'symbol': symbol,
                'current_price': current_price,
                'predicted_1y_price': predicted_1y,
                'predicted_return': predicted_return,
                'trend': trend,
                'confidence_score': 75.0,  # Moderate confidence for simple prediction
                'predictions': predictions[:365],
                'dates': dates[:365],
                'technical_indicators': {
                    'sma_50': float(data['SMA_50'].iloc[-1]) if not pd.isna(data['SMA_50'].iloc[-1]) else None,
                    'sma_200': float(data['SMA_200'].iloc[-1]) if not pd.isna(data['SMA_200'].iloc[-1]) else None,
                    'volatility': float(volatility),
                    'recent_trend': float(recent_trend)
                },
                'model_type': 'simple_fallback'
            }
            
        except Exception as e:
            logger.error(f"Error in simple prediction for {symbol}: {e}")
            return None

# Initialize fallback predictor
fallback_predictor = SimpleFallbackPredictor()

class AdvancedStockPredictor:
    def __init__(self):
        self.scaler = StandardScaler()
        self.model = RandomForestRegressor(
            n_estimators=100,
            max_depth=10,
            random_state=42
        )
        
    def fetch_data(self, symbol: str, period: str = "2y") -> pd.DataFrame:
        """Fetch stock data with comprehensive error handling"""
        try:
            ticker = yf.Ticker(symbol)
            df = ticker.history(period=period)
            
            if df.empty:
                raise ValueError(f"No data found for {symbol}")
                
            # Ensure we have enough data
            if len(df) < 100:
                raise ValueError(f"Insufficient data for {symbol}: {len(df)} days")
                
            return df
            
        except Exception as e:
            logger.error(f"Error fetching data for {symbol}: {e}")
            raise
    
    def calculate_advanced_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """Calculate comprehensive technical indicators"""
        try:
            # Price indicators
            df['sma_10'] = ta.trend.sma_indicator(df['Close'], window=10)
            df['sma_20'] = ta.trend.sma_indicator(df['Close'], window=20)
            df['sma_50'] = ta.trend.sma_indicator(df['Close'], window=50)
            df['sma_200'] = ta.trend.sma_indicator(df['Close'], window=200)
            
            df['ema_12'] = ta.trend.ema_indicator(df['Close'], window=12)
            df['ema_26'] = ta.trend.ema_indicator(df['Close'], window=26)
            
            # Bollinger Bands
            bollinger = ta.volatility.BollingerBands(df['Close'])
            df['bb_high'] = bollinger.bollinger_hband()
            df['bb_low'] = bollinger.bollinger_lband()
            df['bb_width'] = bollinger.bollinger_wband()
            df['bb_percent'] = bollinger.bollinger_pband()
            
            # RSI
            df['rsi'] = ta.momentum.rsi(df['Close'], window=14)
            df['rsi_30'] = 30
            df['rsi_70'] = 70
            
            # MACD
            macd = ta.trend.MACD(df['Close'])
            df['macd'] = macd.macd()
            df['macd_signal'] = macd.macd_signal()
            df['macd_histogram'] = macd.macd_diff()
            
            # Stochastic Oscillator
            stoch = ta.momentum.StochasticOscillator(df['High'], df['Low'], df['Close'])
            df['stoch_k'] = stoch.stoch()
            df['stoch_d'] = stoch.stoch_signal()
            
            # Average True Range (Volatility)
            df['atr'] = ta.volatility.average_true_range(df['High'], df['Low'], df['Close'])
            
            # Volume indicators
            df['volume_sma'] = df['Volume'].rolling(window=20).mean()
            df['volume_ratio'] = df['Volume'] / df['volume_sma']
            
            # On Balance Volume
            df['obv'] = ta.volume.on_balance_volume(df['Close'], df['Volume'])
            
            # Commodity Channel Index
            df['cci'] = ta.trend.cci(df['High'], df['Low'], df['Close'], window=20)
            
            # Williams %R
            df['williams_r'] = ta.momentum.williams_r(df['High'], df['Low'], df['Close'])
            
            # Price rate of change
            df['roc'] = ta.momentum.roc(df['Close'], window=12)
            
            # Momentum indicators
            df['momentum_1w'] = df['Close'].pct_change(5)
            df['momentum_1m'] = df['Close'].pct_change(20)
            df['momentum_3m'] = df['Close'].pct_change(60)
            
            # Volatility
            df['volatility_10d'] = df['Close'].rolling(10).std()
            df['volatility_30d'] = df['Close'].rolling(30).std()
            
            return df
            
        except Exception as e:
            logger.error(f"Error calculating indicators: {e}")
            raise
    
    def prepare_features(self, df: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray]:
        """Prepare features for machine learning"""
        try:
            # Select feature columns
            feature_cols = [
                'sma_10', 'sma_20', 'sma_50', 'sma_200',
                'ema_12', 'ema_26',
                'bb_high', 'bb_low', 'bb_width', 'bb_percent',
                'rsi', 'macd', 'macd_signal', 'macd_histogram',
                'stoch_k', 'stoch_d', 'atr', 'volume_ratio',
                'obv', 'cci', 'williams_r', 'roc',
                'momentum_1w', 'momentum_1m', 'momentum_3m',
                'volatility_10d', 'volatility_30d'
            ]
            
            # Create features matrix
            features = df[feature_cols].copy()
            
            # Create target (next day's closing price)
            target = df['Close'].shift(-1)
            
            # Remove rows with NaN values
            mask = ~(features.isnull().any(axis=1) | target.isnull())
            features = features[mask]
            target = target[mask]
            
            if len(features) < 50:
                raise ValueError("Insufficient clean data for training")
            
            return features.values, target.values
            
        except Exception as e:
            logger.error(f"Error preparing features: {e}")
            raise
    
    def train_and_predict(self, symbol: str) -> Dict:
        """Train model and make predictions"""
        try:
            # Fetch data
            df = self.fetch_data(symbol)
            current_price = float(df['Close'].iloc[-1])
            
            # Calculate indicators
            df = self.calculate_advanced_indicators(df)
            
            # Prepare features
            X, y = self.prepare_features(df)
            
            # Split data for training (use 80% for training)
            split_idx = int(len(X) * 0.8)
            X_train, X_test = X[:split_idx], X[split_idx:]
            y_train, y_test = y[:split_idx], y[split_idx:]
            
            # Scale features
            X_train_scaled = self.scaler.fit_transform(X_train)
            X_test_scaled = self.scaler.transform(X_test)
            
            # Train model
            self.model.fit(X_train_scaled, y_train)
            
            # Evaluate model
            y_pred = self.model.predict(X_test_scaled)
            mae = mean_absolute_error(y_test, y_pred)
            rmse = np.sqrt(mean_squared_error(y_test, y_pred))
            accuracy = 1 - (mae / np.mean(y_test))
            
            # Make future predictions
            predictions = []
            dates = []
            confidence_upper = []
            confidence_lower = []
            
            # Use last known features for prediction
            last_features = X[-1:].copy()
            last_features_scaled = self.scaler.transform(last_features)
            
            current_date = datetime.now()
            
            for i in range(365):  # Predict 1 year ahead
                # Predict next price
                pred_price = self.model.predict(last_features_scaled)[0]
                
                # Calculate confidence intervals based on model uncertainty
                confidence_range = mae * 1.96  # 95% confidence interval
                upper_bound = pred_price + confidence_range
                lower_bound = pred_price - confidence_range
                
                predictions.append(float(pred_price))
                confidence_upper.append(float(upper_bound))
                confidence_lower.append(float(lower_bound))
                
                # Generate business day
                next_date = current_date + timedelta(days=i+1)
                if next_date.weekday() < 5:  # Monday = 0, Friday = 4
                    dates.append(next_date.strftime('%Y-%m-%d'))
                
                # Update features for next prediction (simplified)
                # In practice, you'd update with actual new indicator values
                if len(dates) >= 365:
                    break
            
            # Calculate trend analysis
            price_1y = predictions[-1] if predictions else current_price
            return_1y = (price_1y - current_price) / current_price
            
            if return_1y > 0.2:
                trend = "strongly_bullish"
            elif return_1y > 0.1:
                trend = "bullish"
            elif return_1y > -0.1:
                trend = "neutral"
            elif return_1y > -0.2:
                trend = "bearish"
            else:
                trend = "strongly_bearish"
            
            # Get latest indicator values for display
            latest_indicators = {
                'sma_10': float(df['sma_10'].iloc[-1]) if not pd.isna(df['sma_10'].iloc[-1]) else None,
                'sma_20': float(df['sma_20'].iloc[-1]) if not pd.isna(df['sma_20'].iloc[-1]) else None,
                'sma_50': float(df['sma_50'].iloc[-1]) if not pd.isna(df['sma_50'].iloc[-1]) else None,
                'sma_200': float(df['sma_200'].iloc[-1]) if not pd.isna(df['sma_200'].iloc[-1]) else None,
                'rsi': float(df['rsi'].iloc[-1]) if not pd.isna(df['rsi'].iloc[-1]) else None,
                'macd': float(df['macd'].iloc[-1]) if not pd.isna(df['macd'].iloc[-1]) else None,
                'bb_percent': float(df['bb_percent'].iloc[-1]) if not pd.isna(df['bb_percent'].iloc[-1]) else None,
                'volume_ratio': float(df['volume_ratio'].iloc[-1]) if not pd.isna(df['volume_ratio'].iloc[-1]) else None,
                'volatility_30d': float(df['volatility_30d'].iloc[-1]) if not pd.isna(df['volatility_30d'].iloc[-1]) else None,
                'momentum_1m': float(df['momentum_1m'].iloc[-1]) if not pd.isna(df['momentum_1m'].iloc[-1]) else None,
            }
            
            return {
                'symbol': symbol,
                'current_price': current_price,
                'predicted_1y_price': price_1y,
                'predicted_return': return_1y,
                'trend': trend,
                'model_accuracy': float(accuracy),
                'model_mae': float(mae),
                'model_rmse': float(rmse),
                'predictions': predictions[:365],
                'dates': dates[:365],
                'upper_bound': confidence_upper[:365],
                'lower_bound': confidence_lower[:365],
                'technical_indicators': latest_indicators,
                'prediction_date': datetime.now().isoformat(),
                'confidence_score': min(accuracy * 100, 95.0)  # Cap at 95%
            }
            
        except Exception as e:
            logger.error(f"Error in prediction for {symbol}: {e}")
            raise

# Initialize predictor
predictor = AdvancedStockPredictor()

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'service': 'Advanced Stock Prediction API',
        'status': 'healthy',
        'model': 'Random Forest with Advanced Technical Analysis',
        'features': '25+ technical indicators'
    })

@app.route('/predict/<symbol>', methods=['GET'])
def predict_stock(symbol):
    """Advanced prediction endpoint"""
    try:
        symbol = symbol.upper()
        
        # Check cache first
        cache_key = f"prediction_{symbol}"
        current_time = time.time()
        
        if cache_key in prediction_cache:
            cached_data, timestamp = prediction_cache[cache_key]
            if current_time - timestamp < CACHE_DURATION:
                logger.info(f"Returning cached prediction for {symbol}")
                return jsonify({
                    'success': True,
                    'cached': True,
                    'data': cached_data,
                    'source': 'cache'
                })
        
        # Generate new prediction
        logger.info(f"Generating advanced prediction for {symbol}")
        start_time = time.time()
        
        prediction_data = predictor.train_and_predict(symbol)
        
        # Cache the result
        prediction_cache[cache_key] = (prediction_data, current_time)
        
        end_time = time.time()
        logger.info(f"Advanced prediction for {symbol} completed in {end_time - start_time:.2f} seconds")
        
        return jsonify({
            'success': True,
            'cached': False,
            'data': prediction_data,
            'processing_time': round(end_time - start_time, 2),
            'source': 'fresh'
        })
        
    except Exception as e:
        logger.error(f"Prediction error for {symbol}: {e}")
        return jsonify({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500

@app.route('/predict-simple/<symbol>', methods=['GET'])
def predict_simple(symbol):
    try:
        symbol = symbol.upper()
        
        # Check cache first
        cache_key = f"simple_{symbol}"
        current_time = time.time()
        
        if cache_key in prediction_cache:
            cached_data, timestamp = prediction_cache[cache_key]
            if current_time - timestamp < CACHE_DURATION:
                return jsonify({
                    'success': True,
                    'cached': True,
                    'data': cached_data,
                    'source': 'cache'
                })
        
        # Use appropriate predictor
        if HAS_TENSORFLOW and predictor:
            result = predictor.simple_prediction(symbol)
        else:
            result = fallback_predictor.simple_prediction(symbol)
        
        if result:
            # Cache the result
            prediction_cache[cache_key] = (result, current_time)
            return jsonify({
                'success': True,
                'cached': False,
                'data': result,
                'source': 'fresh'
            })
        else:
            return jsonify({'success': False, 'error': 'Unable to generate simple prediction'}), 500
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/predict-batch', methods=['POST'])
def predict_batch():
    """Batch prediction endpoint"""
    try:
        data = request.get_json()
        symbols = data.get('symbols', [])
        
        if not symbols:
            return jsonify({'success': False, 'error': 'No symbols provided'}), 400
        
        results = {}
        for symbol in symbols:
            try:
                symbol = symbol.upper()
                result = predictor.simple_prediction(symbol)
                results[symbol] = result
            except Exception as e:
                results[symbol] = {'error': str(e)}
        
        return jsonify({'success': True, 'data': results})
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== OPTIONS ENDPOINTS ====================

@app.route('/options-chain/<symbol>', methods=['GET'])
def get_options_chain(symbol):
    """Get complete options chain for a symbol"""
    try:
        symbol = symbol.upper()
        
        # Check cache first
        cache_key = f"options_{symbol}"
        current_time = time.time()
        
        if cache_key in options_cache:
            cached_data, timestamp = options_cache[cache_key]
            if current_time - timestamp < CACHE_DURATION:
                return jsonify({
                    'success': True,
                    'cached': True,
                    'data': cached_data,
                    'source': 'cache'
                })
        
        # Fetch fresh options data
        options_data = options_engine.get_yahoo_options_data(symbol)
        
        if options_data:
            # Cache the result
            options_cache[cache_key] = (options_data, current_time)
            return jsonify({
                'success': True,
                'cached': False,
                'data': options_data,
                'source': 'fresh'
            })
        else:
            return jsonify({'success': False, 'error': f'No options data available for {symbol}'}), 500
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e), 'traceback': traceback.format_exc()}), 500

@app.route('/options-pricing/<symbol>', methods=['GET'])
def calculate_options_pricing(symbol):
    """Calculate theoretical options prices using Black-Scholes"""
    try:
        symbol = symbol.upper()
        strike = float(request.args.get('strike', 100))
        expiration = request.args.get('expiration', '2025-07-18')
        option_type = request.args.get('type', 'call').lower()
        
        # Get current stock price
        options_data = options_engine.get_yahoo_options_data(symbol)
        if not options_data:
            return jsonify({'success': False, 'error': 'Unable to fetch stock data'}), 500
        
        current_price = options_data['currentPrice']
        
        # Calculate time to expiration
        exp_date = datetime.strptime(expiration, '%Y-%m-%d')
        time_to_exp = (exp_date - datetime.now()).days / 365.0
        
        if time_to_exp <= 0:
            return jsonify({'success': False, 'error': 'Option has expired'}), 400
        
        # Calculate theoretical price and Greeks
        if option_type == 'call':
            theoretical_price = options_engine.black_scholes_call(
                current_price, strike, time_to_exp, options_engine.risk_free_rate, 0.25
            )
        else:
            theoretical_price = options_engine.black_scholes_put(
                current_price, strike, time_to_exp, options_engine.risk_free_rate, 0.25
            )
        
        greeks = options_engine.calculate_greeks(
            current_price, strike, time_to_exp, options_engine.risk_free_rate, 0.25, option_type
        )
        
        result = {
            'symbol': symbol,
            'currentPrice': current_price,
            'strike': strike,
            'expiration': expiration,
            'type': option_type,
            'theoreticalPrice': round(theoretical_price, 2),
            'timeToExpiration': time_to_exp,
            'greeks': greeks
        }
        
        return jsonify({'success': True, 'data': result})
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/options-strategy-analysis', methods=['POST'])
def analyze_options_strategy():
    """Analyze complex options strategies"""
    try:
        data = request.get_json()
        strategy_legs = data.get('legs', [])
        current_price = float(data.get('currentPrice', 100))
        
        if not strategy_legs:
            return jsonify({'success': False, 'error': 'No strategy legs provided'}), 400
        
        # Analyze the strategy
        analysis = options_engine.analyze_strategy(strategy_legs, current_price)
        
        return jsonify({'success': True, 'data': analysis})
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e), 'traceback': traceback.format_exc()}), 500

@app.route('/options-strategies', methods=['GET'])
def get_strategy_templates():
    """Get predefined options strategy templates"""
    try:
        return jsonify({'success': True, 'data': STRATEGY_TEMPLATES})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/options-implied-volatility', methods=['POST'])
def calculate_implied_volatility():
    """Calculate implied volatility for an option"""
    try:
        data = request.get_json()
        market_price = float(data.get('marketPrice'))
        current_price = float(data.get('currentPrice'))
        strike = float(data.get('strike'))
        expiration = data.get('expiration')
        option_type = data.get('type', 'call').lower()
        
        # Calculate time to expiration
        exp_date = datetime.strptime(expiration, '%Y-%m-%d')
        time_to_exp = (exp_date - datetime.now()).days / 365.0
        
        if time_to_exp <= 0:
            return jsonify({'success': False, 'error': 'Option has expired'}), 400
        
        # Calculate implied volatility
        iv = options_engine.implied_volatility(
            market_price, current_price, strike, time_to_exp, 
            options_engine.risk_free_rate, option_type
        )
        
        result = {
            'impliedVolatility': iv,
            'marketPrice': market_price,
            'strike': strike,
            'type': option_type,
            'timeToExpiration': time_to_exp
        }
        
        return jsonify({'success': True, 'data': result})
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/options-payoff', methods=['POST'])
def calculate_payoff_diagram():
    """Calculate payoff diagram for options strategy"""
    try:
        data = request.get_json()
        strategy_legs = data.get('legs', [])
        current_price = float(data.get('currentPrice', 100))
        
        # Create spot price range
        spot_range = list(range(
            int(current_price * 0.7), 
            int(current_price * 1.3), 
            int(current_price * 0.01)
        ))
        
        # Calculate payoffs
        payoffs = options_engine.calculate_strategy_payoff(strategy_legs, spot_range)
        
        result = {
            'spotPrices': spot_range,
            'payoffs': payoffs,
            'currentPrice': current_price
        }
        
        return jsonify({'success': True, 'data': result})
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== CACHE MANAGEMENT ====================

@app.route('/cache/status', methods=['GET'])
def cache_status():
    prediction_count = len(prediction_cache)
    options_count = len(options_cache)
    
    return jsonify({
        'prediction_cache_size': prediction_count,
        'options_cache_size': options_count,
        'cache_duration_seconds': CACHE_DURATION
    })

@app.route('/cache/clear', methods=['POST'])
def clear_cache():
    global prediction_cache, options_cache
    prediction_cache = {}
    options_cache = {}
    return jsonify({'success': True, 'message': 'All caches cleared'})

@app.route('/cache/clear-predictions', methods=['POST'])
def clear_prediction_cache():
    global prediction_cache
    prediction_cache = {}
    return jsonify({'success': True, 'message': 'Prediction cache cleared'})

@app.route('/cache/clear-options', methods=['POST'])
def clear_options_cache():
    global options_cache
    options_cache = {}
    return jsonify({'success': True, 'message': 'Options cache cleared'})

if __name__ == '__main__':
    print("🤖 Starting TradeSmart AI Prediction Service with Options Trading...")
    print("📊 Available endpoints:")
    print("   - Stock Predictions: /predict/<symbol>")
    print("   - Options Chains: /options-chain/<symbol>")
    print("   - Options Pricing: /options-pricing/<symbol>")
    print("   - Strategy Analysis: /options-strategy-analysis")
    print("   - Payoff Diagrams: /options-payoff")
    print("🚀 Server running on http://localhost:5000")
    app.run(debug=True, host='0.0.0.0', port=5000) 