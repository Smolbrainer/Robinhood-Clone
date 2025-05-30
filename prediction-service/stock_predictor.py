import yfinance as yf
import pandas as pd
import numpy as np
from sklearn.preprocessing import MinMaxScaler
from sklearn.metrics import mean_squared_error, mean_absolute_error
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.optimizers import Adam
import ta
from datetime import datetime, timedelta
import warnings
warnings.filterwarnings('ignore')

class StockPredictor:
    def __init__(self, symbol):
        self.symbol = symbol.upper()
        self.scaler = MinMaxScaler(feature_range=(0, 1))
        self.model = None
        self.sequence_length = 60  # Use 60 days of data to predict next day
        self.features = []
        
    def fetch_data(self, period="5y"):
        """Fetch historical stock data"""
        try:
            stock = yf.Ticker(self.symbol)
            data = stock.history(period=period)
            
            if data.empty:
                raise ValueError(f"No data found for symbol {self.symbol}")
            
            return data
        except Exception as e:
            print(f"Error fetching data for {self.symbol}: {e}")
            return None
    
    def add_technical_indicators(self, data):
        """Add technical indicators as features"""
        df = data.copy()
        
        # Moving averages
        df['SMA_20'] = ta.trend.sma_indicator(df['Close'], window=20)
        df['SMA_50'] = ta.trend.sma_indicator(df['Close'], window=50)
        df['EMA_12'] = ta.trend.ema_indicator(df['Close'], window=12)
        df['EMA_26'] = ta.trend.ema_indicator(df['Close'], window=26)
        
        # RSI
        df['RSI'] = ta.momentum.rsi(df['Close'], window=14)
        
        # MACD
        macd = ta.trend.MACD(df['Close'])
        df['MACD'] = macd.macd()
        df['MACD_signal'] = macd.macd_signal()
        df['MACD_histogram'] = macd.macd_diff()
        
        # Bollinger Bands
        bollinger = ta.volatility.BollingerBands(df['Close'])
        df['BB_upper'] = bollinger.bollinger_hband()
        df['BB_lower'] = bollinger.bollinger_lband()
        df['BB_middle'] = bollinger.bollinger_mavg()
        
        # Volume indicators
        df['Volume_SMA'] = ta.volume.volume_sma(df['Close'], df['Volume'], window=20)
        
        # Volatility
        df['ATR'] = ta.volatility.average_true_range(df['High'], df['Low'], df['Close'])
        
        # Price momentum
        df['Price_Change'] = df['Close'].pct_change()
        df['Volume_Change'] = df['Volume'].pct_change()
        
        # Support and resistance levels
        df['High_20'] = df['High'].rolling(window=20).max()
        df['Low_20'] = df['Low'].rolling(window=20).min()
        
        return df
    
    def prepare_data(self, data):
        """Prepare data for LSTM model"""
        # Add technical indicators
        df = self.add_technical_indicators(data)
        
        # Select features for training
        feature_columns = [
            'Open', 'High', 'Low', 'Close', 'Volume',
            'SMA_20', 'SMA_50', 'EMA_12', 'EMA_26', 'RSI',
            'MACD', 'MACD_signal', 'MACD_histogram',
            'BB_upper', 'BB_lower', 'BB_middle', 'Volume_SMA',
            'ATR', 'Price_Change', 'Volume_Change', 'High_20', 'Low_20'
        ]
        
        # Remove rows with NaN values
        df = df.dropna()
        
        if len(df) < self.sequence_length + 1:
            raise ValueError("Not enough data after removing NaN values")
        
        # Prepare features and target
        features = df[feature_columns].values
        target = df['Close'].values
        
        # Scale features
        features_scaled = self.scaler.fit_transform(features)
        
        # Create sequences
        X, y = [], []
        for i in range(self.sequence_length, len(features_scaled)):
            X.append(features_scaled[i-self.sequence_length:i])
            y.append(target[i])
        
        X, y = np.array(X), np.array(y)
        
        # Split into train and test sets
        split_index = int(len(X) * 0.8)
        X_train, X_test = X[:split_index], X[split_index:]
        y_train, y_test = y[:split_index], y[split_index:]
        
        self.features = feature_columns
        return X_train, X_test, y_train, y_test, df
    
    def build_model(self, input_shape):
        """Build LSTM model"""
        model = Sequential([
            LSTM(100, return_sequences=True, input_shape=input_shape),
            Dropout(0.2),
            LSTM(100, return_sequences=True),
            Dropout(0.2),
            LSTM(50, return_sequences=False),
            Dropout(0.2),
            Dense(25),
            Dense(1)
        ])
        
        model.compile(optimizer=Adam(learning_rate=0.001), loss='mse', metrics=['mae'])
        return model
    
    def train(self, epochs=50, batch_size=32):
        """Train the prediction model"""
        print(f"Training model for {self.symbol}...")
        
        # Fetch and prepare data
        data = self.fetch_data()
        if data is None:
            return False
        
        X_train, X_test, y_train, y_test, processed_data = self.prepare_data(data)
        
        # Build and train model
        self.model = self.build_model((X_train.shape[1], X_train.shape[2]))
        
        history = self.model.fit(
            X_train, y_train,
            epochs=epochs,
            batch_size=batch_size,
            validation_data=(X_test, y_test),
            verbose=1
        )
        
        # Evaluate model
        train_pred = self.model.predict(X_train)
        test_pred = self.model.predict(X_test)
        
        train_mse = mean_squared_error(y_train, train_pred)
        test_mse = mean_squared_error(y_test, test_pred)
        
        print(f"Training MSE: {train_mse:.4f}")
        print(f"Testing MSE: {test_mse:.4f}")
        
        return True
    
    def predict_future(self, days=365):
        """Predict future stock prices"""
        if self.model is None:
            raise ValueError("Model not trained. Call train() first.")
        
        # Get recent data for prediction
        data = self.fetch_data(period="2y")
        df = self.add_technical_indicators(data)
        df = df.dropna()
        
        # Prepare last sequence for prediction
        feature_columns = self.features
        last_sequence = df[feature_columns].tail(self.sequence_length).values
        last_sequence_scaled = self.scaler.transform(last_sequence)
        
        predictions = []
        current_sequence = last_sequence_scaled.copy()
        
        # Get the last actual close price
        last_close = df['Close'].iloc[-1]
        
        for day in range(days):
            # Reshape for prediction
            input_sequence = current_sequence.reshape(1, self.sequence_length, len(feature_columns))
            
            # Make prediction
            next_price = self.model.predict(input_sequence, verbose=0)[0][0]
            predictions.append(next_price)
            
            # Update sequence for next prediction
            # Create new feature row based on predicted price
            new_features = current_sequence[-1].copy()
            
            # Update price-related features (simplified)
            price_change = (next_price - last_close) / last_close if last_close > 0 else 0
            
            # Update the sequence
            current_sequence = np.roll(current_sequence, -1, axis=0)
            current_sequence[-1] = new_features
            
            last_close = next_price
        
        return predictions
    
    def get_prediction_with_confidence(self, days=365):
        """Get predictions with confidence intervals"""
        predictions = self.predict_future(days)
        
        # Calculate confidence intervals based on historical volatility
        data = self.fetch_data(period="1y")
        daily_returns = data['Close'].pct_change().dropna()
        volatility = daily_returns.std()
        
        # Generate dates for predictions
        start_date = datetime.now() + timedelta(days=1)
        dates = [start_date + timedelta(days=i) for i in range(days)]
        
        # Calculate confidence bands
        confidence_factor = 1.96  # 95% confidence interval
        upper_bound = []
        lower_bound = []
        
        for i, pred in enumerate(predictions):
            # Increase uncertainty over time
            time_factor = 1 + (i / days) * 2  # Uncertainty grows over time
            uncertainty = pred * volatility * confidence_factor * time_factor
            upper_bound.append(pred + uncertainty)
            lower_bound.append(max(0, pred - uncertainty))  # Ensure price doesn't go negative
        
        return {
            'dates': [d.strftime('%Y-%m-%d') for d in dates],
            'predictions': predictions,
            'upper_bound': upper_bound,
            'lower_bound': lower_bound,
            'current_price': data['Close'].iloc[-1],
            'symbol': self.symbol
        }

def get_stock_prediction(symbol, days=365):
    """Main function to get stock predictions"""
    try:
        predictor = StockPredictor(symbol)
        
        # Train the model
        success = predictor.train(epochs=30)
        if not success:
            return None
        
        # Get predictions
        result = predictor.get_prediction_with_confidence(days)
        return result
        
    except Exception as e:
        print(f"Error predicting {symbol}: {e}")
        return None

if __name__ == "__main__":
    # Test the predictor
    symbol = "AAPL"
    prediction = get_stock_prediction(symbol, days=365)
    
    if prediction:
        print(f"\nPrediction for {symbol}:")
        print(f"Current Price: ${prediction['current_price']:.2f}")
        print(f"Predicted Price in 1 year: ${prediction['predictions'][-1]:.2f}")
        print(f"Confidence Range: ${prediction['lower_bound'][-1]:.2f} - ${prediction['upper_bound'][-1]:.2f}")
    else:
        print(f"Failed to generate prediction for {symbol}") 