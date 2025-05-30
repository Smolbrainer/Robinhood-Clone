import React, { useState, useEffect, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Line } from 'react-chartjs-2'
import TimeLine from './TimeLine'
import './StockPage.css'
import { useAuth } from './AuthContext'
import { getUserPortfolio, buyStock, sellStock, addToWatchlist } from './userData'

import StockChart from './stock.svg'
import StockChart2 from './stock2.svg'
import negativeStockChart2 from './negStock.svg'

const FMP_KEY = process.env.REACT_APP_FMP_KEY || "X5t0qm3ru74kZNRha7rSywlO8At81XrG";
const PREDICTION_API_URL = 'http://localhost:5000';

const sparkOptions = {
  plugins: { 
    legend: { display: false }, 
    tooltip: { 
      mode: 'index', 
      intersect: false,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      titleColor: '#fff',
      bodyColor: '#fff',
      borderColor: '#333',
      borderWidth: 1,
      padding: 12,
      callbacks: {
        label: function(context) {
          return `$${context.parsed.y.toFixed(2)}`;
        }
      }
    } 
  },
  interaction: { 
    mode: 'index', 
    intersect: false 
  },
  elements: { 
    line: { 
      tension: 0.4,
      borderWidth: 2
    }, 
    point: { 
      radius: 0
    } 
  },
  maintainAspectRatio: false,
  scales: {
    x: { 
      type: 'time', 
      time: { 
        unit: 'day',
        tooltipFormat: 'MMM d, h:mm a'
      }, 
      grid: {
        display: false
      },
      ticks: { 
        display: true,
        font: {
          size: 12,
          family: "'Inter', sans-serif"
        },
        color: '#888'
      },
      border: {
        display: true,
        color: '#333'
      }
    },
    y: { 
      grid: { 
        display: false
      }, 
      ticks: { 
        display: true,
        font: {
          size: 12,
          family: "'Inter', sans-serif"
        },
        color: '#888',
        callback: function(value) {
          return '$' + value.toLocaleString();
        }
      },
      border: {
        display: true,
        color: '#333'
      }
    },
  },
}

const RANGE_DAYS = {
  LIVE: 1,
  '1D': 1,
  '1W': 7,
  '3M': 90,
  '1Y': 365,
  '5Y': 1825,
}

export default function StockPage() {
  const { symbol } = useParams()
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const [quote, setQuote] = useState({ open: 0, price: 0 })
  const [chartData, setChartData] = useState([])
  const [error, setError] = useState(false)
  const [sharesToTrade, setSharesToTrade] = useState(1)
  const [trading, setTrading] = useState(false)
  const [range, setRange] = useState('1D')
  const [portfolio, setPortfolio] = useState(null)
  const [userHolding, setUserHolding] = useState(null)
  const [tradeError, setTradeError] = useState('')
  const [wishlistLoading, setWishlistLoading] = useState(false)
  const [wishlistMsg, setWishlistMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const [news, setNews] = useState([])
  const [newsLoading, setNewsLoading] = useState(true)
  const [predictionData, setPredictionData] = useState(null)
  const [predictionLoading, setPredictionLoading] = useState(false)
  const [predictionError, setPredictionError] = useState(null)
  const [showPredictions, setShowPredictions] = useState(false)

  useEffect(() => {
    async function loadPortfolio() {
      if (!currentUser) return;
      const userPortfolio = await getUserPortfolio(currentUser.uid);
      setPortfolio(userPortfolio);
      
      if (userPortfolio?.stocks) {
        const holding = userPortfolio.stocks.find(stock => stock.symbol === symbol);
        setUserHolding(holding);
      }
    }
    loadPortfolio();
    // Refresh portfolio data every 30 seconds
    const interval = setInterval(loadPortfolio, 30000);
    return () => clearInterval(interval);
  }, [currentUser, symbol]);

  useEffect(() => {
    async function fetchQuote() {
      try {
        setLoading(true);
        const response = await fetch(`https://financialmodelingprep.com/api/v3/quote/${symbol}?apikey=${FMP_KEY}`);
        const data = await response.json();
        if (data && data[0]) {
          setQuote({
            ...data[0],  // Include all data from the API response
            open: data[0].open,
            price: data[0].price,
            change: data[0].changesPercentage
          });
        }
      } catch (err) {
        console.error('Error fetching quote:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchQuote();
    // Refresh quote every 30 seconds
    const interval = setInterval(fetchQuote, 30000);
    return () => clearInterval(interval);
  }, [symbol]);

  useEffect(() => {
    async function fetchHistoricalData() {
      try {
        setLoading(true);
        const days = RANGE_DAYS[range] || 30;
        const response = await fetch(
          `https://financialmodelingprep.com/api/v3/historical-chart/${days}day/${symbol}?apikey=${FMP_KEY}`
        );
        const data = await response.json();
        
        if (data && data.length > 0) {
          const formattedData = data.reverse().map(item => ({
            x: new Date(item.date),
            y: item.close
          }));
          setChartData(formattedData);
        }
      } catch (err) {
        console.error('Error fetching historical data:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchHistoricalData();
  }, [symbol, range]);

  useEffect(() => {
    async function fetchNews() {
      try {
        setNewsLoading(true);
        const response = await fetch(`https://financialmodelingprep.com/stable/news/stock?symbols=${symbol}&apikey=${FMP_KEY}`);
        const data = await response.json();
        setNews(data);
      } catch (err) {
        console.error('Error fetching news:', err);
      } finally {
        setNewsLoading(false);
      }
    }
    fetchNews();
  }, [symbol]);

  const { open, price: current, change } = quote;
  const pct = change || 0;
  const isUp = pct >= 0;

  const fallback = useMemo(() => {
    if (!isUp) return negativeStockChart2;
    return Math.random() < 0.5 ? StockChart : StockChart2;
  }, [isUp]);

  // Prepare chart data including predictions
  const getChartData = () => {
    const datasets = [{
      label: 'Historical Price',
      data: chartData,
      borderColor: isUp ? '#5AC53B' : '#ff4d4d',
      backgroundColor: isUp ? 'rgba(90, 197, 59, 0.1)' : 'rgba(255, 77, 77, 0.1)',
      fill: false,
      pointRadius: 0,
      pointHoverRadius: 3,
    }];

    // Add prediction data if available and enabled
    if (showPredictions && predictionData && predictionData.predictions) {
      const predictionPoints = predictionData.dates.map((date, index) => ({
        x: new Date(date),
        y: predictionData.predictions[index]
      }));

      // Connect last historical point to first prediction point
      const lastHistorical = chartData[chartData.length - 1];
      if (lastHistorical && predictionPoints.length > 0) {
        predictionPoints.unshift(lastHistorical);
      }

      datasets.push({
        label: 'AI Prediction',
        data: predictionPoints,
        borderColor: '#ff6b6b',
        backgroundColor: 'rgba(255, 107, 107, 0.1)',
        borderDash: [5, 5],
        fill: false,
        pointRadius: 0,
        pointHoverRadius: 3,
      });

      // Add confidence bands if available
      if (predictionData.upper_bound && predictionData.lower_bound) {
        const upperBound = predictionData.dates.map((date, index) => ({
          x: new Date(date),
          y: predictionData.upper_bound[index]
        }));
        
        const lowerBound = predictionData.dates.map((date, index) => ({
          x: new Date(date),
          y: predictionData.lower_bound[index]
        }));

        datasets.push({
          label: 'Upper Confidence',
          data: upperBound,
          borderColor: 'rgba(255, 107, 107, 0.3)',
          backgroundColor: 'rgba(255, 107, 107, 0.05)',
          borderDash: [2, 2],
          fill: false,
          pointRadius: 0,
        });

        datasets.push({
          label: 'Lower Confidence',
          data: lowerBound,
          borderColor: 'rgba(255, 107, 107, 0.3)',
          backgroundColor: 'rgba(255, 107, 107, 0.05)',
          borderDash: [2, 2],
          fill: false,
          pointRadius: 0,
        });
      }
    }

    return { datasets };
  };

  async function handleBuy(e) {
    e.preventDefault();
    setTradeError('');
    setTrading(true);
    try {
      const totalCost = sharesToTrade * current;
      if (totalCost > portfolio.cash) {
        setTradeError('Insufficient funds');
        return;
      }

      await buyStock(currentUser.uid, {
        symbol,
        shares: sharesToTrade,
        price: current
      });
      
      // Refresh portfolio data
      const updatedPortfolio = await getUserPortfolio(currentUser.uid);
      setPortfolio(updatedPortfolio);
      const holding = updatedPortfolio.stocks.find(stock => stock.symbol === symbol);
      setUserHolding(holding);
      
      alert(`Bought ${sharesToTrade} share(s) of ${symbol}!`);
    } catch (err) {
      console.error('Buy error:', err);
      setTradeError('Purchase failed. Please try again.');
    } finally {
      setTrading(false);
    }
  }

  async function handleSell(e) {
    e.preventDefault();
    setTradeError('');
    setTrading(true);
    try {
      if (!userHolding || userHolding.shares < sharesToTrade) {
        setTradeError('Not enough shares to sell');
        return;
      }

      await sellStock(currentUser.uid, {
        symbol,
        shares: sharesToTrade,
        price: current
      });
      
      // Refresh portfolio data
      const updatedPortfolio = await getUserPortfolio(currentUser.uid);
      setPortfolio(updatedPortfolio);
      const holding = updatedPortfolio.stocks.find(stock => stock.symbol === symbol);
      setUserHolding(holding);
      
      alert(`Sold ${sharesToTrade} share(s) of ${symbol}!`);
    } catch (err) {
      console.error('Sell error:', err);
      setTradeError('Sale failed. Please try again.');
    } finally {
      setTrading(false);
    }
  }

  async function handleAddToWishlist() {
    if (!currentUser || !symbol) return;
    setWishlistLoading(true);
    setWishlistMsg("");
    try {
      const userPortfolio = await getUserPortfolio(currentUser.uid);
      if (userPortfolio?.watchlist?.includes(symbol)) {
        setWishlistMsg("Already in wishlist");
      } else {
        await addToWatchlist(currentUser.uid, symbol);
        setWishlistMsg("Added to wishlist!");
      }
    } catch (err) {
      setWishlistMsg("Error adding to wishlist");
    } finally {
      setWishlistLoading(false);
    }
  }

  // Fetch AI predictions for the stock
  const fetchPredictions = async () => {
    if (!symbol) return;
    
    setPredictionLoading(true);
    setPredictionError(null);
    
    try {
      const response = await fetch(`${PREDICTION_API_URL}/predict-simple/${symbol}`);
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setPredictionData(result.data);
        } else {
          setPredictionError(result.error || 'Failed to load prediction');
        }
      } else {
        setPredictionError('Prediction service unavailable');
      }
    } catch (error) {
      console.error('Error fetching predictions:', error);
      setPredictionError('Unable to connect to prediction service');
    } finally {
      setPredictionLoading(false);
    }
  };

  // Toggle predictions display
  const togglePredictions = () => {
    if (!showPredictions && !predictionData) {
      fetchPredictions();
    }
    setShowPredictions(!showPredictions);
  };

  return (
    <>
      <div className="stockPage">
        <aside className="leftPanel">
          <div className="backLink">
            <Link to="/">← Back to Home</Link>
          </div>
          <h2 className="symbolTitle">
            {symbol}
            <button onClick={handleAddToWishlist} disabled={wishlistLoading} style={{marginLeft: 16, padding: '4px 12px', borderRadius: 4, background: '#5AC53B', color: 'white', border: 'none', cursor: 'pointer', fontSize: 14}}>
              {wishlistLoading ? 'Adding...' : 'Add to Wishlist'}
            </button>
            {wishlistMsg && <span style={{marginLeft: 12, color: '#888', fontSize: 13}}>{wishlistMsg}</span>}
          </h2>

          <div className="chartWrapper">
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                Loading...
              </div>
            ) : chartData.length > 0 && !error ? (
              <Line
                data={getChartData()}
                options={sparkOptions}
                redraw
              />
            ) : (
              <img src={fallback} alt="chart fallback" />
            )}
          </div>

          {/* AI Prediction Controls */}
          <div className="predictionControls">
            <button 
              className={`predictionToggle ${showPredictions ? 'active' : ''}`}
              onClick={togglePredictions}
              disabled={predictionLoading}
            >
              {predictionLoading ? (
                <>
                  <span className="spinner"></span>
                  Loading AI...
                </>
              ) : (
                <>
                  🔮 AI Predictions
                  {showPredictions && <span className="checkmark">✓</span>}
                </>
              )}
            </button>
            
            {predictionError && (
              <div className="predictionError">
                ⚠️ {predictionError}
              </div>
            )}
          </div>

          {/* AI Prediction Information */}
          {showPredictions && predictionData && (
            <div className="predictionCard">
              <h3>🤖 AI Price Forecast</h3>
              <div className="predictionSummary">
                <div className="predictionMetric">
                  <span className="label">Current Price</span>
                  <span className="value">${predictionData.current_price?.toFixed(2)}</span>
                </div>
                <div className="predictionMetric">
                  <span className="label">1-Year Prediction</span>
                  <span className="value">${predictionData.predicted_1y_price?.toFixed(2)}</span>
                </div>
                <div className="predictionMetric">
                  <span className="label">Expected Return</span>
                  <span className={`value ${predictionData.predicted_return >= 0 ? 'positive' : 'negative'}`}>
                    {predictionData.predicted_return >= 0 ? '+' : ''}{(predictionData.predicted_return * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="predictionMetric">
                  <span className="label">Trend Analysis</span>
                  <span className={`value trend-${predictionData.trend}`}>
                    {predictionData.trend?.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
              </div>
              
              {predictionData.technical_indicators && (
                <div className="technicalIndicators">
                  <h4>Technical Analysis</h4>
                  <div className="indicatorGrid">
                    <div className="indicator">
                      <span className="label">20-Day MA</span>
                      <span className="value">${predictionData.technical_indicators.ma_20?.toFixed(2)}</span>
                    </div>
                    <div className="indicator">
                      <span className="label">50-Day MA</span>
                      <span className="value">${predictionData.technical_indicators.ma_50?.toFixed(2)}</span>
                    </div>
                    <div className="indicator">
                      <span className="label">1M Momentum</span>
                      <span className={`value ${predictionData.technical_indicators.momentum_1m >= 0 ? 'positive' : 'negative'}`}>
                        {(predictionData.technical_indicators.momentum_1m * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="indicator">
                      <span className="label">Volume Ratio</span>
                      <span className="value">{predictionData.technical_indicators.volume_ratio?.toFixed(2)}x</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="predictionDisclaimer">
                <p>⚠️ <strong>Disclaimer:</strong> This is an AI-generated prediction for educational purposes only. Not financial advice. Always do your own research before investing.</p>
              </div>
            </div>
          )}

          {!loading && open != null && current != null && (
            <p className="percentage" style={{ color: isUp ? '#5AC53B' : '#ff4d4d' }}>
              {isUp ? '+' : ''}{pct.toFixed(2)}%
            </p>
          )}

          <TimeLine range={range} setRange={setRange} />

          <div className="aboutCard">
            <h3>About {symbol}</h3>
            {loading ? (
              <div>Loading...</div>
            ) : (
              <ul>
                <li>
                  <span className="label">Company:</span>
                  <span className="value">{quote.name}</span>
                </li>
                <li>
                  <span className="label">Exchange:</span>
                  <span className="value">{quote.exchange}</span>
                </li>
                <li>
                  <span className="label">Market Cap:</span>
                  <span className="value">${(quote.marketCap / 1e9).toFixed(2)}B</span>
                </li>
                <li>
                  <span className="label">Volume:</span>
                  <span className="value">{quote.volume?.toLocaleString()}</span>
                </li>
                <li>
                  <span className="label">Avg Volume:</span>
                  <span className="value">{quote.avgVolume?.toLocaleString()}</span>
                </li>
                <li>
                  <span className="label">Previous Close:</span>
                  <span className="value">${quote.previousClose?.toFixed(2)}</span>
                </li>
                <li>
                  <span className="label">Open:</span>
                  <span className="value">${quote.open?.toFixed(2)}</span>
                </li>
                <li>
                  <span className="label">Day Range:</span>
                  <span className="value">${quote.dayLow?.toFixed(2)} - ${quote.dayHigh?.toFixed(2)}</span>
                </li>
                <li>
                  <span className="label">52-Week Range:</span>
                  <span className="value">${quote.yearLow?.toFixed(2)} - ${quote.yearHigh?.toFixed(2)}</span>
                </li>
                <li>
                  <span className="label">50-Day Avg:</span>
                  <span className="value">${quote.priceAvg50?.toFixed(2)}</span>
                </li>
                <li>
                  <span className="label">200-Day Avg:</span>
                  <span className="value">${quote.priceAvg200?.toFixed(2)}</span>
                </li>
                <li>
                  <span className="label">EPS:</span>
                  <span className="value">${quote.eps?.toFixed(2)}</span>
                </li>
                <li>
                  <span className="label">P/E Ratio:</span>
                  <span className="value">{quote.pe?.toFixed(2)}</span>
                </li>
                <li>
                  <span className="label">Shares Outstanding:</span>
                  <span className="value">{quote.sharesOutstanding?.toLocaleString()}</span>
                </li>
                <li>
                  <span className="label">Next Earnings:</span>
                  <span className="value">{quote.earningsAnnouncement ? new Date(quote.earningsAnnouncement).toLocaleDateString() : 'N/A'}</span>
                </li>
              </ul>
            )}
          </div>
        </aside>

        <aside className="rightPanel">
          <div className="buyCard">
            <h3>Trade {symbol}</h3>
            {userHolding && (
              <div className="holdingInfo">
                <p>Your Position: {userHolding.shares} shares</p>
                <p>Avg. Price: ${userHolding.averagePrice.toFixed(2)}</p>
              </div>
            )}
            {tradeError && (
              <p className="error">{tradeError}</p>
            )}
            <form onSubmit={handleBuy}>
              <label>
                Shares:
                <input
                  type="number"
                  min="1"
                  value={sharesToTrade}
                  onChange={e => setSharesToTrade(+e.target.value)}
                />
              </label>
              <div className="tradeButtons">
                <button type="submit" disabled={trading || loading}>
                  {trading ? 'Processing…' : 'Buy'}
                </button>
                {userHolding && (
                  <button 
                    type="button" 
                    onClick={handleSell}
                    disabled={trading || loading}
                    className="sellButton"
                  >
                    {trading ? 'Processing…' : 'Sell'}
                  </button>
                )}
              </div>
            </form>
            <div className="tradeInfo">
              <p>Current Price: ${current?.toFixed(2)}</p>
              <p>Total: ${(sharesToTrade * current)?.toFixed(2)}</p>
              {portfolio && (
                <p>Available Cash: ${portfolio.cash?.toFixed(2)}</p>
              )}
            </div>
          </div>

          <div className="newsCard">
            <h3>Latest News</h3>
            {newsLoading ? (
              <div>Loading news...</div>
            ) : news.length > 0 ? (
              <div className="newsList">
                {news.slice(0, 5).map((item, index) => (
                  <a 
                    key={index} 
                    href={item.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="newsItem"
                  >
                    {item.image && (
                      <div className="newsImage">
                        <img src={item.image} alt={item.title} />
                      </div>
                    )}
                    <div className="newsContent">
                      <h4>{item.title}</h4>
                      <p>{item.text}</p>
                      <div className="newsMeta">
                        <span>{item.publisher}</span>
                        <span>{new Date(item.publishedDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div>No news available</div>
            )}
          </div>
        </aside>
      </div>
    </>
  )
}