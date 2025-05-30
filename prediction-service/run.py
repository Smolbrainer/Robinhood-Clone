#!/usr/bin/env python3
"""
Simple runner for the Stock Prediction API
This script starts the Flask server and provides a simple prediction service
"""

import sys
import subprocess
import os
from pathlib import Path

def install_requirements():
    """Install required packages"""
    try:
        print("Installing requirements...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        print("✓ Requirements installed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"✗ Error installing requirements: {e}")
        return False

def check_python_version():
    """Check if Python version is compatible"""
    if sys.version_info < (3, 8):
        print("✗ Python 3.8 or higher is required")
        return False
    print(f"✓ Python {sys.version} detected")
    return True

def start_server():
    """Start the Flask server"""
    try:
        print("\n" + "="*50)
        print("🚀 Starting Stock Prediction API Server")
        print("="*50)
        print("📊 Features:")
        print("  • LSTM Neural Network predictions")
        print("  • Technical indicators analysis")
        print("  • 1-year future forecasting")
        print("  • Confidence intervals")
        print("  • Caching for performance")
        print("\n🌐 Server will be available at:")
        print("  • http://localhost:5000")
        print("  • Health check: http://localhost:5000/health")
        print("  • Simple prediction: http://localhost:5000/predict-simple/AAPL")
        print("\n⏱️  Note: First prediction may take 2-3 minutes to train the model")
        print("=" * 50 + "\n")
        
        # Import and start the Flask app
        from app import app
        app.run(debug=True, host='0.0.0.0', port=5000)
        
    except ImportError as e:
        print(f"✗ Import error: {e}")
        print("Make sure all requirements are installed")
        return False
    except Exception as e:
        print(f"✗ Error starting server: {e}")
        return False

def main():
    """Main function"""
    print("🔮 Stock Prediction Service Setup")
    print("-" * 40)
    
    # Check Python version
    if not check_python_version():
        sys.exit(1)
    
    # Install requirements
    if not install_requirements():
        print("\n💡 Try installing manually:")
        print("   pip install flask flask-cors yfinance pandas numpy scikit-learn tensorflow")
        sys.exit(1)
    
    # Start server
    start_server()

if __name__ == "__main__":
    main() 