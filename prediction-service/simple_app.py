from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import time
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Simple cache
prediction_cache = {}
cache_duration = 3600 * 6  # 6 hours

def is_cache_valid(timestamp):
    return time.time() - timestamp < cache_duration

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "service": "Simple Stock Prediction API"})

@app.route('/predict-simple/<symbol>', methods=['GET'])
def predict_simple(symbol):
    """Simplified prediction endpoint using technical analysis"""
    try:
        symbol = symbol.upper()
        
        # Check cache first
        cache_key = f"simple_{symbol}"
        if cache_key in prediction_cache:
            cached_data, timestamp = prediction_cache[cache_key]
            if is_cache_valid(timestamp):
                return jsonify({
                    "success": True,
                    "data": cached_data,
                    "cached": True,
                    "message": f"Cached prediction for {symbol}"
                })
        
        # Fetch historical data
        stock = yf.Ticker(symbol)
        data = stock.history(period="2y")  # 2 years of data
        
        if data.empty:
            return jsonify({
                "success": False,
                "error": f"No data found for {symbol}"
            }), 400
        
        # Calculate technical indicators
        current_price = data['Close'].iloc[-1]
        
        # Moving averages
        ma_5 = data['Close'].rolling(window=5).mean().iloc[-1]
        ma_20 = data['Close'].rolling(window=20).mean().iloc[-1]
        ma_50 = data['Close'].rolling(window=50).mean().iloc[-1]
        ma_200 = data['Close'].rolling(window=200).mean().iloc[-1]
        
        # Price momentum
        price_1m_ago = data['Close'].iloc[-22] if len(data) > 22 else current_price
        price_3m_ago = data['Close'].iloc[-66] if len(data) > 66 else current_price
        price_6m_ago = data['Close'].iloc[-132] if len(data) > 132 else current_price
        
        momentum_1m = (current_price - price_1m_ago) / price_1m_ago
        momentum_3m = (current_price - price_3m_ago) / price_3m_ago
        momentum_6m = (current_price - price_6m_ago) / price_6m_ago
        
        # Volatility (standard deviation of returns)
        returns = data['Close'].pct_change().dropna()
        volatility = returns.std() * np.sqrt(252)  # Annualized volatility
        
        # Volume analysis
        avg_volume = data['Volume'].rolling(window=20).mean().iloc[-1]
        current_volume = data['Volume'].iloc[-1]
        volume_ratio = current_volume / avg_volume if avg_volume > 0 else 1
        
        # Determine trend strength and direction
        trend_score = 0
        
        # Moving average alignment
        if current_price > ma_5 > ma_20 > ma_50:
            trend_score += 2  # Strong bullish
        elif current_price > ma_20 > ma_50:
            trend_score += 1  # Bullish
        elif current_price < ma_5 < ma_20 < ma_50:
            trend_score -= 2  # Strong bearish
        elif current_price < ma_20 < ma_50:
            trend_score -= 1  # Bearish
        
        # Momentum contribution
        if momentum_1m > 0.05:  # 5% gain in 1 month
            trend_score += 1
        elif momentum_1m < -0.05:  # 5% loss in 1 month
            trend_score -= 1
            
        if momentum_3m > 0.15:  # 15% gain in 3 months
            trend_score += 1
        elif momentum_3m < -0.15:  # 15% loss in 3 months
            trend_score -= 1
        
        # Volume confirmation
        if volume_ratio > 1.5:  # High volume
            trend_score += 0.5 if trend_score > 0 else -0.5
        
        # Calculate prediction parameters
        base_annual_return = 0.08  # Base 8% annual return for market
        trend_factor = trend_score * 0.02  # 2% per trend point
        volatility_factor = min(volatility, 0.5)  # Cap volatility impact
        
        # Final annual return estimate
        annual_return = base_annual_return + trend_factor
        
        # Generate predictions for 1 year
        days = 365
        start_date = datetime.now() + timedelta(days=1)
        dates = [(start_date + timedelta(days=i)).strftime('%Y-%m-%d') for i in range(days)]
        
        predictions = []
        confidence_upper = []
        confidence_lower = []
        
        for i in range(days):
            # Calculate predicted price with compound growth
            days_factor = i / 365.0
            
            # Base prediction with some randomness
            growth_factor = (1 + annual_return) ** days_factor
            
            # Add some cyclical variation
            seasonal_factor = 1 + 0.02 * np.sin(2 * np.pi * i / 365.0)
            
            # Random walk component
            random_factor = 1 + np.random.normal(0, 0.001)  # Small daily randomness
            
            predicted_price = current_price * growth_factor * seasonal_factor * random_factor
            predictions.append(predicted_price)
            
            # Confidence intervals based on volatility
            uncertainty = predicted_price * volatility_factor * np.sqrt(days_factor)
            confidence_upper.append(predicted_price + uncertainty)
            confidence_lower.append(max(0, predicted_price - uncertainty))
        
        # Calculate key metrics
        end_price = predictions[-1]
        total_return = (end_price - current_price) / current_price
        
        # Determine trend classification
        if trend_score >= 2:
            trend = "strongly_bullish"
        elif trend_score >= 1:
            trend = "bullish"
        elif trend_score <= -2:
            trend = "strongly_bearish"
        elif trend_score <= -1:
            trend = "bearish"
        else:
            trend = "neutral"
        
        result = {
            "symbol": symbol,
            "current_price": float(current_price),
            "predicted_1y_price": float(end_price),
            "predicted_return": float(total_return),
            "dates": dates,
            "predictions": [float(p) for p in predictions],
            "upper_bound": [float(u) for u in confidence_upper],
            "lower_bound": [float(l) for l in confidence_lower],
            "trend": trend,
            "trend_score": float(trend_score),
            "volatility": float(volatility),
            "technical_indicators": {
                "ma_5": float(ma_5),
                "ma_20": float(ma_20),
                "ma_50": float(ma_50),
                "ma_200": float(ma_200),
                "momentum_1m": float(momentum_1m),
                "momentum_3m": float(momentum_3m),
                "momentum_6m": float(momentum_6m),
                "volume_ratio": float(volume_ratio)
            }
        }
        
        # Cache the result
        prediction_cache[cache_key] = (result, time.time())
        
        return jsonify({
            "success": True,
            "data": result,
            "cached": False,
            "message": f"Generated prediction for {symbol}"
        })
        
    except Exception as e:
        print(f"Error in predict_simple: {e}")
        return jsonify({
            "success": False,
            "error": str(e),
            "message": "Failed to generate prediction"
        }), 500

@app.route('/predict/<symbol>', methods=['GET'])
def predict_advanced(symbol):
    """Advanced prediction - for now, same as simple but with different endpoint"""
    return predict_simple(symbol)

@app.route('/cache/status', methods=['GET'])
def cache_status():
    """Get cache status"""
    cache_info = {}
    for key, (data, timestamp) in prediction_cache.items():
        cache_info[key] = {
            "symbol": data.get('symbol'),
            "cached_at": timestamp,
            "valid": is_cache_valid(timestamp),
            "age_hours": (time.time() - timestamp) / 3600
        }
    
    return jsonify({
        "success": True,
        "cache_entries": len(prediction_cache),
        "cache_info": cache_info
    })

@app.route('/cache/clear', methods=['POST'])
def clear_cache():
    """Clear prediction cache"""
    global prediction_cache
    prediction_cache = {}
    return jsonify({
        "success": True,
        "message": "Cache cleared successfully"
    })

if __name__ == '__main__':
    print("🔮 Starting Simple Stock Prediction API...")
    print("🌐 Server running at: http://localhost:5000")
    print("📊 Features:")
    print("  • Technical analysis-based predictions")
    print("  • Moving averages & momentum analysis")
    print("  • Volatility-based confidence intervals")
    print("  • 1-year future forecasting")
    print("  • Real-time caching")
    print("\n🧪 Test endpoints:")
    print("  • Health: http://localhost:5000/health")
    print("  • Predict: http://localhost:5000/predict-simple/AAPL")
    print("  • Cache: http://localhost:5000/cache/status")
    print("=" * 50)
    
    app.run(debug=True, host='0.0.0.0', port=5000) 