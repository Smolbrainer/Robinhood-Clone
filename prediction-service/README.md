# 🔮 Stock Prediction Service

A sophisticated stock price prediction system using LSTM neural networks and technical indicators to forecast stock movements for up to 1 year.

## 🌟 Features

- **LSTM Neural Networks**: Deep learning model for accurate predictions
- **Technical Indicators**: RSI, MACD, Bollinger Bands, Moving Averages
- **Confidence Intervals**: 95% confidence bands for predictions
- **RESTful API**: Easy integration with web applications
- **Caching System**: Optimized performance with 24-hour cache
- **Real-time Data**: Uses Yahoo Finance for up-to-date stock data

## 🚀 Quick Start

### Prerequisites
- Python 3.8 or higher
- pip (Python package manager)

### Installation & Setup

1. **Navigate to the prediction service directory:**
   ```bash
   cd prediction-service
   ```

2. **Run the setup script:**
   ```bash
   python run.py
   ```
   
   This will:
   - Check Python version
   - Install all required packages
   - Start the Flask API server

3. **Alternative manual installation:**
   ```bash
   pip install -r requirements.txt
   python app.py
   ```

### 🧪 Testing the API

Once the server is running, test it with these endpoints:

#### Health Check
```bash
curl http://localhost:5000/health
```

#### Simple Prediction (Fast)
```bash
curl http://localhost:5000/predict-simple/AAPL
```

#### Full AI Prediction (Advanced)
```bash
curl http://localhost:5000/predict/AAPL
```

## 📡 API Endpoints

### GET `/health`
Health check endpoint
```json
{
  "status": "healthy",
  "service": "Stock Prediction API"
}
```

### GET `/predict-simple/{symbol}`
Fast trend-based prediction
- **Parameters**: `symbol` (stock ticker)
- **Response**: Simple prediction based on moving averages
- **Speed**: ~1-2 seconds

### GET `/predict/{symbol}`
Advanced AI prediction using LSTM
- **Parameters**: `symbol` (stock ticker), `days` (optional, max 365)
- **Response**: Detailed prediction with confidence intervals
- **Speed**: ~2-3 minutes (first time), cached afterwards

### POST `/predict-batch`
Batch predictions for multiple symbols
```json
{
  "symbols": ["AAPL", "MSFT", "GOOGL"],
  "days": 365
}
```

### GET `/cache/status`
View cache status and information

### POST `/cache/clear`
Clear prediction cache

## 🔧 Integration with React App

The prediction service is already integrated with your Robinhood clone:

1. **LineGraph Component**: Enhanced with AI prediction toggle
2. **Real-time Integration**: Fetches predictions on demand
3. **Visual Indicators**: Dashed lines for predicted values
4. **Error Handling**: Graceful fallbacks if prediction service is unavailable

### Using in React

```javascript
// Fetch prediction for a symbol
const response = await fetch('http://localhost:5000/predict-simple/AAPL');
const result = await response.json();

if (result.success) {
  const { predictions, dates, current_price } = result.data;
  // Use prediction data in your charts
}
```

## 🧠 How It Works

### 1. Data Collection
- Fetches 5+ years of historical stock data
- Includes OHLCV (Open, High, Low, Close, Volume)
- Real-time data from Yahoo Finance

### 2. Feature Engineering
- **Technical Indicators**: SMA, EMA, RSI, MACD, Bollinger Bands
- **Volume Analysis**: Volume SMA, volume changes
- **Volatility Measures**: ATR (Average True Range)
- **Support/Resistance**: Rolling highs and lows

### 3. Model Architecture
```
LSTM(100) → Dropout(0.2) → 
LSTM(100) → Dropout(0.2) → 
LSTM(50)  → Dropout(0.2) → 
Dense(25) → Dense(1)
```

### 4. Prediction Process
- **Training**: 80% data for training, 20% for validation
- **Sequence Length**: 60 days of historical data
- **Output**: Daily price predictions for up to 365 days
- **Confidence**: Calculated using historical volatility

## 📊 Prediction Accuracy

- **Training MSE**: Typically < 0.1 for well-traded stocks
- **Validation**: 20% holdout data for unbiased evaluation
- **Confidence Intervals**: 95% statistical confidence bands
- **Uncertainty**: Increases over time (realistic approach)

## ⚠️ Important Notes

### Performance
- **First Prediction**: 2-3 minutes (model training)
- **Cached Results**: Instant response
- **Cache Duration**: 24 hours
- **Memory Usage**: ~500MB during training

### Limitations
- Predictions are **estimates**, not guarantees
- Market volatility can exceed model expectations
- External events (news, earnings) not factored in
- Best used as **one factor** in investment decisions

### Financial Disclaimer
This tool is for educational and informational purposes only. It should not be considered as financial advice. Always do your own research and consult with financial professionals before making investment decisions.

## 🛠️ Development

### Project Structure
```
prediction-service/
├── app.py              # Flask API server
├── stock_predictor.py  # Core prediction logic
├── requirements.txt    # Python dependencies
├── run.py             # Setup and runner script
└── README.md          # This file
```

### Adding New Features

1. **New Indicators**: Add to `add_technical_indicators()` method
2. **Model Improvements**: Modify `build_model()` architecture
3. **API Endpoints**: Add new routes in `app.py`

### Debugging

Enable verbose logging:
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

View training progress:
```python
# In stock_predictor.py, set verbose=1 in model.fit()
history = self.model.fit(..., verbose=1)
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add your improvements
4. Test thoroughly
5. Submit a pull request

## 📈 Future Enhancements

- [ ] Multiple model ensemble
- [ ] Sentiment analysis integration
- [ ] Real-time news impact analysis
- [ ] Options pricing models
- [ ] Cryptocurrency support
- [ ] Portfolio optimization suggestions

## 🆘 Troubleshooting

### Common Issues

**"ModuleNotFoundError"**
```bash
pip install -r requirements.txt
```

**"Port 5000 already in use"**
```bash
# Kill existing process
pkill -f "python.*app.py"
# Or change port in app.py
```

**"Prediction failed"**
- Check internet connection
- Verify stock symbol exists
- Ensure sufficient historical data

**"Training too slow"**
- Reduce epochs (default: 30)
- Use simpler model architecture
- Enable GPU if available

### Getting Help

1. Check the server logs for detailed error messages
2. Test with simple endpoint first: `/predict-simple/AAPL`
3. Verify all dependencies are installed correctly
4. Ensure Python 3.8+ is being used

---

## 🎯 Quick Commands

```bash
# Start service
python run.py

# Test health
curl http://localhost:5000/health

# Get AAPL prediction
curl http://localhost:5000/predict-simple/AAPL

# Clear cache
curl -X POST http://localhost:5000/cache/clear
```

Happy predicting! 🚀📈 