from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import os
from stock_predictor import get_stock_prediction
import threading
import time

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Cache to store predictions to avoid retraining
prediction_cache = {}
cache_duration = 3600 * 24  # 24 hours in seconds

def is_cache_valid(timestamp):
    """Check if cached prediction is still valid"""
    return time.time() - timestamp < cache_duration

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "service": "Stock Prediction API"})

@app.route('/predict/<symbol>', methods=['GET'])
def predict_stock(symbol):
    """Get stock prediction for a given symbol"""
    try:
        symbol = symbol.upper()
        
        # Check cache first
        cache_key = f"{symbol}_365"
        if cache_key in prediction_cache:
            cached_data, timestamp = prediction_cache[cache_key]
            if is_cache_valid(timestamp):
                return jsonify({
                    "success": True,
                    "data": cached_data,
                    "cached": True,
                    "message": f"Cached prediction for {symbol}"
                })
        
        # Get prediction parameters
        days = request.args.get('days', 365, type=int)
        days = min(days, 365)  # Limit to 1 year max
        
        print(f"Generating prediction for {symbol} for {days} days...")
        
        # Generate prediction
        prediction = get_stock_prediction(symbol, days)
        
        if prediction is None:
            return jsonify({
                "success": False,
                "error": f"Failed to generate prediction for {symbol}",
                "message": "Could not fetch data or train model for this symbol"
            }), 400
        
        # Cache the result
        prediction_cache[cache_key] = (prediction, time.time())
        
        return jsonify({
            "success": True,
            "data": prediction,
            "cached": False,
            "message": f"Generated fresh prediction for {symbol}"
        })
        
    except Exception as e:
        print(f"Error in predict_stock: {e}")
        return jsonify({
            "success": False,
            "error": str(e),
            "message": "Internal server error"
        }), 500

@app.route('/predict-batch', methods=['POST'])
def predict_batch():
    """Get predictions for multiple symbols"""
    try:
        data = request.get_json()
        symbols = data.get('symbols', [])
        days = data.get('days', 365)
        
        if not symbols:
            return jsonify({
                "success": False,
                "error": "No symbols provided"
            }), 400
        
        results = {}
        for symbol in symbols:
            try:
                symbol = symbol.upper()
                cache_key = f"{symbol}_{days}"
                
                # Check cache
                if cache_key in prediction_cache:
                    cached_data, timestamp = prediction_cache[cache_key]
                    if is_cache_valid(timestamp):
                        results[symbol] = {
                            "success": True,
                            "data": cached_data,
                            "cached": True
                        }
                        continue
                
                # Generate fresh prediction
                prediction = get_stock_prediction(symbol, days)
                
                if prediction:
                    prediction_cache[cache_key] = (prediction, time.time())
                    results[symbol] = {
                        "success": True,
                        "data": prediction,
                        "cached": False
                    }
                else:
                    results[symbol] = {
                        "success": False,
                        "error": f"Failed to generate prediction for {symbol}"
                    }
                    
            except Exception as e:
                results[symbol] = {
                    "success": False,
                    "error": str(e)
                }
        
        return jsonify({
            "success": True,
            "results": results
        })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/cache/clear', methods=['POST'])
def clear_cache():
    """Clear prediction cache"""
    global prediction_cache
    prediction_cache = {}
    return jsonify({
        "success": True,
        "message": "Cache cleared successfully"
    })

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

@app.route('/predict-simple/<symbol>', methods=['GET'])
def predict_simple(symbol):
    """Simplified prediction endpoint for quick testing"""
    try:
        symbol = symbol.upper()
        
        # Use a simpler prediction for faster response
        import yfinance as yf
        import pandas as pd
        from datetime import datetime, timedelta
        
        # Fetch recent data
        stock = yf.Ticker(symbol)
        data = stock.history(period="1y")
        
        if data.empty:
            return jsonify({
                "success": False,
                "error": f"No data found for {symbol}"
            }), 400
        
        # Simple trend analysis
        current_price = data['Close'].iloc[-1]
        
        # Calculate moving averages for trend
        ma_20 = data['Close'].rolling(window=20).mean().iloc[-1]
        ma_50 = data['Close'].rolling(window=50).mean().iloc[-1]
        
        # Simple trend direction
        trend_factor = 1.0
        if current_price > ma_20 > ma_50:
            trend_factor = 1.1  # Bullish
        elif current_price < ma_20 < ma_50:
            trend_factor = 0.9  # Bearish
        
        # Generate simple predictions
        days = 365
        start_date = datetime.now() + timedelta(days=1)
        dates = [(start_date + timedelta(days=i)).strftime('%Y-%m-%d') for i in range(days)]
        
        # Simple linear progression with some randomness
        daily_growth = (trend_factor - 1) / 365
        predictions = []
        
        for i in range(days):
            # Add some volatility
            volatility = 0.02 * (i / 365)  # Increase uncertainty over time
            predicted_price = current_price * (1 + daily_growth * i) * (1 + volatility)
            predictions.append(predicted_price)
        
        return jsonify({
            "success": True,
            "data": {
                "symbol": symbol,
                "current_price": current_price,
                "dates": dates,
                "predictions": predictions,
                "trend": "bullish" if trend_factor > 1 else "bearish" if trend_factor < 1 else "neutral"
            },
            "message": "Simple trend-based prediction"
        })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

if __name__ == '__main__':
    print("Starting Stock Prediction API...")
    print("Available endpoints:")
    print("  GET  /health - Health check")
    print("  GET  /predict/<symbol> - Get prediction for a symbol")
    print("  GET  /predict-simple/<symbol> - Get simple prediction")
    print("  POST /predict-batch - Get predictions for multiple symbols")
    print("  POST /cache/clear - Clear prediction cache")
    print("  GET  /cache/status - Get cache status")
    
    app.run(debug=True, host='0.0.0.0', port=5000) 