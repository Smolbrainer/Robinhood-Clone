import React, { useState, useEffect, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  TimeScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import zoomPlugin from 'chartjs-plugin-zoom'
import 'chartjs-adapter-moment'
import TimeLine from './TimeLine'
import './StockPage.css'
import { useAuth } from './AuthContext'
import { getUserPortfolio, buyStock, sellStock, addToWatchlist } from './userData'

import StockChart from './stock.svg'
import StockChart2 from './stock2.svg'
import negativeStockChart2 from './negStock.svg'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  TimeScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  zoomPlugin
);

const FMP_KEY = process.env.REACT_APP_FMP_KEY || "X5t0qm3ru74kZNRha7rSywlO8At81XrG";
const PREDICTION_API_URL = 'http://localhost:5000';

// Fixed tooltip dates and labeling - version 3.0 SIMPLE
const sparkOptions = {
  plugins: { 
    legend: { 
      display: true,
      position: 'top',
      labels: {
        color: '#fff',
        font: {
          size: 14,
          family: "'Inter', sans-serif",
          weight: '500'
        },
        usePointStyle: true,
        padding: 20,
        generateLabels: function(chart) {
          const data = chart.data;
          if (data.datasets.length) {
            return data.datasets.map(function(dataset, i) {
              return {
                text: dataset.label,
                fillStyle: dataset.borderColor,
                strokeStyle: dataset.borderColor,
                lineWidth: dataset.borderWidth,
                lineDash: dataset.borderDash || [],
                hidden: !chart.isDatasetVisible(i),
                datasetIndex: i
              };
            });
          }
          return [];
        }
      }
    }, 
    tooltip: { 
      mode: 'index', 
      intersect: false,
      backgroundColor: 'rgba(0, 0, 0, 0.95)',
      titleColor: '#fff',
      bodyColor: '#fff',
      borderColor: '#8B5CF6',
      borderWidth: 2,
      padding: 20,
      cornerRadius: 12,
      displayColors: true,
      titleFont: {
        size: 14,
        weight: '600'
      },
      bodyFont: {
        size: 13,
        weight: '500'
      },
      callbacks: {
        title: function(context) {
          const date = new Date(context[0].parsed.x);
          
          // Debug logging for date issues
          console.log('🗓️ Tooltip date debug:', {
            rawParsedX: context[0].parsed.x,
            dateObject: date,
            formattedDate: date.toLocaleDateString('en-US', {
              weekday: 'short',
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            }),
            isValidDate: !isNaN(date.getTime()),
            datasetLabel: context[0].dataset.label
          });
          
          // Handle invalid dates
          if (isNaN(date.getTime())) {
            console.warn('⚠️ Invalid date in tooltip, using current date');
            return new Date().toLocaleDateString('en-US', {
              weekday: 'short',
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            });
          }
          
          return date.toLocaleDateString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          });
        },
        label: function(context) {
          const label = context.dataset.label || '';
          const price = (context.parsed?.y || context.raw?.y || 0).toFixed(2);
          
          if (label === 'Historical Price') {
            return `💰 ${label}: $${price}`;
          } else {
            return `🔮 ${label}: $${price}`;
          }
        }
      }
    },
    zoom: {
      zoom: {
        wheel: {
          enabled: true,
        },
        pinch: {
          enabled: true
        },
        mode: 'x',
      },
      pan: {
        enabled: true,
        mode: 'x',
      }
    }
  },
  interaction: { 
    mode: 'index', 
    intersect: false 
  },
  elements: { 
    line: { 
      tension: 0.2,
      borderWidth: 3
    }, 
    point: { 
      radius: 0,
      hoverRadius: 8,
      hitRadius: 15,
      borderWidth: 3,
      backgroundColor: '#fff'
    } 
  },
  maintainAspectRatio: false,
  responsive: true,
  scales: {
    x: { 
      type: 'time', 
      time: { 
        unit: 'day', // Will be updated dynamically
        displayFormats: {
          hour: 'HH:mm',
          day: 'MMM D',
          week: 'MMM D',
          month: 'MMM YYYY',
          year: 'YYYY'
        }
      }, 
      grid: {
        display: true,
        color: 'rgba(255, 255, 255, 0.08)',
        lineWidth: 1
      },
      ticks: { 
        display: true,
        font: {
          size: 12,
          family: "'Inter', sans-serif",
          weight: '500'
        },
        color: '#bbb',
        maxTicksLimit: 8,
        padding: 10
      },
      border: {
        display: true,
        color: 'rgba(255, 255, 255, 0.2)',
        width: 2
      }
    },
    y: { 
      grid: { 
        display: true,
        color: 'rgba(255, 255, 255, 0.08)',
        lineWidth: 1
      }, 
      ticks: { 
        display: true,
        font: {
          size: 12,
          family: "'Inter', sans-serif",
          weight: '500'
        },
        color: '#bbb',
        padding: 15,
        callback: function(value) {
          return '$' + value.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          });
        }
      },
      border: {
        display: true,
        color: 'rgba(255, 255, 255, 0.2)',
        width: 2
      }
    },
  },
}

const RANGE_DAYS = {
  LIVE: 1,
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
  const [range, setRange] = useState('LIVE')
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
  const [stockVolatility, setStockVolatility] = useState(0)
  const [priceTargets, setPriceTargets] = useState(null)
  const [priceTargetsLoading, setPriceTargetsLoading] = useState(false)
  const [priceTargetsError, setPriceTargetsError] = useState(null)
  const [grades, setGrades] = useState([])
  const [gradesLoading, setGradesLoading] = useState(false)
  const [gradesError, setGradesError] = useState(null)
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Reset prediction state when stock symbol changes
  useEffect(() => {
    // Clear all prediction-related state for clean slate on new stock
    setPredictionData(null)
    setPredictionLoading(false)
    setPredictionError(null)
    setShowPredictions(false)
    setStockVolatility(0)
    
    // Clear analyst data too
    setPriceTargets(null)
    setPriceTargetsError(null)
    setGrades([])
    setGradesError(null)
    
    // Optional: You could also add a brief loading indicator here
    // to show that the page is switching to a new stock
  }, [symbol]);

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
    
    // Auto-refresh portfolio data every 1 minute if enabled
    let portfolioInterval;
    if (autoRefreshEnabled && currentUser) {
      portfolioInterval = setInterval(loadPortfolio, 60000);
    }
    
    return () => {
      if (portfolioInterval) clearInterval(portfolioInterval);
    };
  }, [currentUser, symbol, autoRefreshEnabled]);

  useEffect(() => {
    async function fetchQuote() {
      try {
        if (autoRefreshEnabled) setIsRefreshing(true);
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
        setLastRefresh(new Date());
      } catch (err) {
        console.error('Error fetching quote:', err);
        setError(true);
      } finally {
        setLoading(false);
        if (autoRefreshEnabled) {
          setTimeout(() => setIsRefreshing(false), 500); // Brief delay to show refresh indicator
        }
      }
    }

    fetchQuote();
    
    // Auto-refresh every 30 seconds if enabled
    let quoteInterval;
    if (autoRefreshEnabled) {
      quoteInterval = setInterval(fetchQuote, 30000);
    }
    
    return () => {
      if (quoteInterval) clearInterval(quoteInterval);
    };
  }, [symbol, autoRefreshEnabled]);

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
          console.log('📊 Raw historical data sample:', data.slice(0, 3));
          
          // Check if data is too old (2021)
          const firstDate = new Date(data[0]?.date);
          const isOldData = firstDate.getFullYear() < 2024;
          
          if (isOldData) {
            console.warn('⚠️ Historical data is from', firstDate.getFullYear(), '- generating recent data for demo');
            
            // Generate recent historical data for demo purposes using clean dates
            const currentDate = new Date();
            const formattedData = data.reverse().map((item, index) => {
              // Create dates going backwards from today with clean date format
              const demoDate = new Date(currentDate);
              demoDate.setDate(currentDate.getDate() - (data.length - index));
              
              // Clean the date to match prediction format (noon to avoid timezone issues)
              const cleanDemoDate = new Date(
                demoDate.getFullYear(),
                demoDate.getMonth(),
                demoDate.getDate(),
                12, 0, 0, 0 // Noon to avoid timezone edge cases
              );
              
              // Debug first few historical dates
              if (index < 3) {
                console.log('📊 Historical date creation:', {
                  index,
                  originalDate: item.date,
                  demoDate: demoDate.toLocaleDateString(),
                  cleanDemoDate: cleanDemoDate.toLocaleDateString(),
                  cleanDemoDateISO: cleanDemoDate.toISOString(),
                  timestamp: cleanDemoDate.getTime(),
                  price: item.close
                });
              }
              
              return {
                x: cleanDemoDate,
                y: item.close
              };
            });
            setChartData(formattedData);
            console.log('📊 Generated recent historical data:', formattedData.slice(-3));
          } else {
            // Use actual recent data with clean date format
            const formattedData = data.reverse().map(item => {
              const originalDate = new Date(item.date);
              const cleanDate = new Date(
                originalDate.getFullYear(),
                originalDate.getMonth(),
                originalDate.getDate(),
                12, 0, 0, 0 // Noon to avoid timezone edge cases
              );
              
              return {
                x: cleanDate,
                y: item.close
              };
            });
            setChartData(formattedData);
            console.log('📊 Using actual historical data:', formattedData.slice(-3));
          }
        }
      } catch (err) {
        console.error('Error fetching historical data:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchHistoricalData();

    // Auto-refresh chart data every 2 minutes if enabled
    let chartInterval;
    if (autoRefreshEnabled) {
      chartInterval = setInterval(fetchHistoricalData, 120000);
    }
    
    return () => {
      if (chartInterval) clearInterval(chartInterval);
    };
  }, [symbol, range, autoRefreshEnabled]);

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

    // Auto-refresh news every 5 minutes if enabled
    let newsInterval;
    if (autoRefreshEnabled) {
      newsInterval = setInterval(fetchNews, 300000);
    }
    
    return () => {
      if (newsInterval) clearInterval(newsInterval);
    };
  }, [symbol, autoRefreshEnabled]);

  useEffect(() => {
    async function fetchPriceTargets() {
      try {
        setPriceTargetsLoading(true);
        setPriceTargetsError(null);
        const response = await fetch(`https://financialmodelingprep.com/stable/price-target-summary?symbol=${symbol}&apikey=${FMP_KEY}`);
        const data = await response.json();
        
        if (data && data.length > 0) {
          setPriceTargets(data[0]);
        } else {
          setPriceTargetsError('No analyst targets available');
        }
      } catch (err) {
        console.error('Error fetching price targets:', err);
        setPriceTargetsError('Unable to load analyst targets');
      } finally {
        setPriceTargetsLoading(false);
      }
    }
    fetchPriceTargets();

    // Auto-refresh price targets every 10 minutes if enabled
    let targetsInterval;
    if (autoRefreshEnabled) {
      targetsInterval = setInterval(fetchPriceTargets, 600000);
    }
    
    return () => {
      if (targetsInterval) clearInterval(targetsInterval);
    };
  }, [symbol, autoRefreshEnabled]);

  useEffect(() => {
    async function fetchGrades() {
      try {
        setGradesLoading(true);
        setGradesError(null);
        const response = await fetch(`https://financialmodelingprep.com/stable/grades?symbol=${symbol}&apikey=${FMP_KEY}`);
        const data = await response.json();
        
        if (data && Array.isArray(data)) {
          // Sort by date (most recent first) and take top 3
          const sortedGrades = data
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 3);
          setGrades(sortedGrades);
        } else {
          setGradesError('No analyst grades available');
        }
      } catch (err) {
        console.error('Error fetching grades:', err);
        setGradesError('Unable to load analyst grades');
      } finally {
        setGradesLoading(false);
      }
    }
    fetchGrades();

    // Auto-refresh grades every 15 minutes if enabled  
    let gradesInterval;
    if (autoRefreshEnabled) {
      gradesInterval = setInterval(fetchGrades, 900000);
    }
    
    return () => {
      if (gradesInterval) clearInterval(gradesInterval);
    };
  }, [symbol, autoRefreshEnabled]);

  // Calculate and store stock volatility when chart data changes
  useEffect(() => {
    if (chartData.length < 2) {
      setStockVolatility(0.02); // Default 2% volatility
      return;
    }
    
    const returns = [];
    for (let i = 1; i < chartData.length; i++) {
      const dailyReturn = (chartData[i].y - chartData[i-1].y) / chartData[i-1].y;
      returns.push(dailyReturn);
    }
    
    // Calculate standard deviation of returns
    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance);
    
    // Clamp between reasonable bounds (0.5% to 8% daily volatility)
    const clampedVolatility = Math.max(0.005, Math.min(0.08, volatility));
    setStockVolatility(clampedVolatility);
  }, [chartData]);

  const { open, price: current, change } = quote;
  const pct = change || 0;
  const isUp = pct >= 0;

  const fallback = useMemo(() => {
    if (!isUp) return negativeStockChart2;
    return Math.random() < 0.5 ? StockChart : StockChart2;
  }, [isUp]);

  // Prepare chart data including predictions
  const getChartData = () => {
    const datasets = [];

    // Filter data based on selected range since FMP gives us 5-year data
    const getFilteredData = (data) => {
      if (!data || data.length === 0) return data;
      
      const now = new Date();
      let startDate;
      
      switch(range) {
        case '1W':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '3M':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case '1Y':
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        case '5Y':
        default:
          return data; // Return all data for 5Y
      }
      
      return data.filter(point => new Date(point.x) >= startDate);
    };

    // Always show historical data first
    const filteredChartData = getFilteredData(chartData);
    datasets.push({
      label: 'Historical Price',
      data: filteredChartData,
      borderColor: isUp ? '#00C805' : '#ff4d4d',
      backgroundColor: isUp ? 'rgba(0, 200, 5, 0.1)' : 'rgba(255, 77, 77, 0.1)',
      fill: false,
      pointRadius: 0,
      pointHoverRadius: 6,
      borderWidth: 3,
      tension: 0.2,
    });

    // Add 3 prediction lines if available and enabled
    if (showPredictions && predictionData && predictionData.predictions) {
      // Use the last point from the COMPLETE historical data, not filtered data
      const lastHistorical = chartData[chartData.length - 1]; // Complete data
      
      // Create a clean current date (today at noon) to avoid timezone issues
      const now = new Date();
      const currentDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        12, 0, 0, 0 // Noon to avoid timezone edge cases
      );
      
      console.log('📅 Base current date:', {
        rawNow: now.toISOString(),
        cleanCurrentDate: currentDate.toISOString(),
        cleanTimestamp: currentDate.getTime()
      });
      
      // Helper function to create realistic choppy prediction line
      const createPredictionLine = (values, label, color, style = 'solid', volatilityBias = 0) => {
        const predictionPoints = [];
        
        // Get starting point (last historical price or current price)
        const startPrice = lastHistorical ? lastHistorical.y : values[0];
        const endPrice = values[values.length - 1]; // Final prediction target
        const totalDays = predictionData.dates.length;
        
        // Generate choppy, realistic movements starting from current date
        predictionData.dates.forEach((date, index) => {
          let price;
          
          if (index === 0) {
            // First point: slight deviation from start
            price = startPrice + (Math.random() - 0.5) * startPrice * 0.02;
          } else if (index === totalDays - 1) {
            // Last point: reach the target with some noise
            price = endPrice + (Math.random() - 0.5) * endPrice * 0.01;
          } else {
            // Middle points: choppy movement trending toward target
            const progress = index / (totalDays - 1);
            
            // Linear trend toward target
            const trendPrice = startPrice + (endPrice - startPrice) * progress;
            
            // Add realistic daily volatility (1-3% swings) with bias
            const volatility = stockVolatility;
            const dailyChange = (Math.random() - 0.5 + volatilityBias) * volatility;
            
            // Previous day's price for momentum
            const prevPrice = predictionPoints[index - 1]?.y || startPrice;
            
            // Combine trend + momentum + volatility
            const momentum = (prevPrice - startPrice) * (stockVolatility * 2); // Momentum based on volatility
            price = trendPrice + (prevPrice * dailyChange) + momentum;
            
            // Add some mean reversion (pull back toward trend) - less for volatile stocks
            const deviation = price - trendPrice;
            const meanReversionStrength = Math.max(0.1, 0.4 - (stockVolatility * 5)); // Lower reversion for volatile stocks
            price = price - (deviation * meanReversionStrength);
            
            // Ensure reasonable bounds (adjusted for stock volatility)
            const maxDeviation = startPrice * (0.3 + stockVolatility * 10); // Wider bounds for volatile stocks
            price = Math.max(startPrice - maxDeviation, Math.min(startPrice + maxDeviation, price));
          }
          
          // Create prediction dates starting from current date + index days
          // This ensures predictions always start from "today" regardless of chart view
          const predictionDate = new Date(currentDate);
          predictionDate.setDate(predictionDate.getDate() + index + 1); // Start from tomorrow
          
          // Clean the date to avoid Chart.js parsing issues
          // Set to noon UTC to avoid timezone conversion problems
          const cleanPredictionDate = new Date(
            predictionDate.getFullYear(),
            predictionDate.getMonth(),
            predictionDate.getDate(),
            12, 0, 0, 0 // Noon to avoid timezone edge cases
          );
          
          // Debug logging for prediction dates
          if (index < 5) {
            console.log('🔮 Prediction date creation:', {
              index,
              currentDate: currentDate.toLocaleDateString(),
              predictionDate: predictionDate.toLocaleDateString(),
              cleanPredictionDate: cleanPredictionDate.toLocaleDateString(),
              cleanPredictionDateISO: cleanPredictionDate.toISOString(),
              timestamp: cleanPredictionDate.getTime(),
              price,
              label
            });
          }
          
          predictionPoints.push({
            x: cleanPredictionDate,
            y: Math.max(0.01, price) // Ensure positive price
          });
        });

        // Connect to last historical point for seamless continuation
        // Use the last point from filtered data for visual connection
        const lastFilteredHistorical = filteredChartData[filteredChartData.length - 1];
        let seamlessData;
        if (lastFilteredHistorical && predictionPoints.length > 0) {
          // Create a clean connection date (today at noon)
          const cleanConnectionDate = new Date(
            currentDate.getFullYear(),
            currentDate.getMonth(),
            currentDate.getDate(),
            12, 0, 0, 0 // Noon to avoid timezone edge cases
          );
          
          // Create a connection point that bridges to predictions
          const connectionPoint = {
            x: cleanConnectionDate, // Use clean current date as connection
            y: startPrice, // Use the actual last price
            _isHistoricalConnection: true
          };
          
          // Debug connection point
          console.log('🔗 Connection point:', {
            connectionDate: cleanConnectionDate.toLocaleDateString(),
            connectionDateISO: cleanConnectionDate.toISOString(),
            connectionTimestamp: cleanConnectionDate.getTime(),
            connectionPrice: startPrice,
            label
          });
          
          seamlessData = [connectionPoint, ...predictionPoints];
        } else {
          seamlessData = predictionPoints;
        }
        
        return {
          label: label,
          data: seamlessData,
          borderColor: color,
          backgroundColor: 'transparent',
          fill: false,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 2,
          borderDash: style === 'dashed' ? [5, 5] : [],
          tension: 0.1, // Slight smoothing for realistic curves
        };
      };

      // 1. Main Prediction Line (Middle) - moderate volatility
      datasets.push(createPredictionLine(
        predictionData.predictions,
        'AI Prediction',
        '#ff6b6b',
        'solid',
        0.0 // Neutral bias
      ));

      // 2. Upper Bound Prediction Line - more aggressive volatility
      if (predictionData.upper_bound) {
        // Create more volatile upper bound based on stock's actual volatility
        const enhancedUpperBound = predictionData.upper_bound.map((price, index) => {
          const baseTrend = price;
          const extraVolatility = (Math.random() - 0.4) * price * (stockVolatility * 1.5); // 1.5x stock volatility
          return Math.max(price * 0.8, baseTrend + extraVolatility);
        });
        
        datasets.push(createPredictionLine(
          enhancedUpperBound,
          'Upper Bound',
          '#ffa500',
          'solid',
          0.15 // Upward bias
        ));
      }

      // 3. Lower Bound Prediction Line - conservative volatility
      if (predictionData.lower_bound) {
        // Create more conservative lower bound based on stock's actual volatility
        const enhancedLowerBound = predictionData.lower_bound.map((price, index) => {
          const baseTrend = price;
          const extraVolatility = (Math.random() - 0.6) * price * (stockVolatility * 1.2); // 1.2x stock volatility
          return Math.min(price * 1.2, Math.max(price * 0.5, baseTrend + extraVolatility));
        });
        
        datasets.push(createPredictionLine(
          enhancedLowerBound,
          'Lower Bound',
          '#87ceeb',
          'solid',
          -0.15 // Downward bias
        ));
      }
    }

    return { datasets };
  };

  // Get dynamic chart options based on range
  const getDynamicChartOptions = () => {
    const baseOptions = { ...sparkOptions };
    
    // Update time scale based on range
    switch(range) {
      case '1W':
        baseOptions.scales.x.time.unit = 'day';
        baseOptions.scales.x.ticks.maxTicksLimit = 7;
        break;
      case '3M':
        baseOptions.scales.x.time.unit = 'week';
        baseOptions.scales.x.ticks.maxTicksLimit = 8;
        break;
      case '1Y':
        baseOptions.scales.x.time.unit = 'month';
        baseOptions.scales.x.ticks.maxTicksLimit = 12;
        break;
      case '5Y':
      default:
        baseOptions.scales.x.time.unit = 'year';
        baseOptions.scales.x.ticks.maxTicksLimit = 6;
        break;
    }
    
    // Ensure proper time parsing for predictions
    baseOptions.scales.x.time.parser = false; // Let Chart.js auto-detect
    baseOptions.scales.x.adapters = {
      date: {}
    };
    
    return baseOptions;
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
      const response = await fetch(`${PREDICTION_API_URL}/predict/${symbol}`);
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
            <button onClick={handleAddToWishlist} disabled={wishlistLoading} style={{marginLeft: 16, padding: '4px 12px', borderRadius: 4, background: '#8B5CF6', color: 'white', border: 'none', cursor: 'pointer', fontSize: 14}}>
              {wishlistLoading ? 'Adding...' : 'Add to Wishlist'}
            </button>
            {wishlistMsg && <span style={{marginLeft: 12, color: '#888', fontSize: 13}}>{wishlistMsg}</span>}
            
            {/* Auto-refresh controls */}
            <div className="refreshControls" style={{marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px'}}>
              <button 
                onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
                style={{
                  padding: '6px 12px', 
                  borderRadius: 6, 
                  background: autoRefreshEnabled ? '#00C805' : '#333', 
                  color: 'white', 
                  border: 'none', 
                  cursor: 'pointer', 
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {autoRefreshEnabled ? '🔄 Live' : '⏸️ Paused'}
              </button>
              
              {isRefreshing && (
                <div className="refreshIndicator" style={{
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px', 
                  color: '#8B5CF6', 
                  fontSize: 12,
                  fontWeight: 500
                }}>
                  <div className="spinner" style={{
                    width: 12, 
                    height: 12, 
                    border: '2px solid rgba(139, 92, 246, 0.3)', 
                    borderTop: '2px solid #8B5CF6', 
                    borderRadius: '50%', 
                    animation: 'spin 1s linear infinite'
                  }}></div>
                  Updating...
                </div>
              )}
              
              <span style={{color: '#888', fontSize: 11}}>
                Last: {lastRefresh.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </span>
            </div>
          </h2>

          <div className="chartWrapper">
            <div className="chartControls">
              <div className="chartButtons">
                <button 
                  className="chartBtn"
                  onClick={() => {
                    // Reset zoom/pan
                    const chart = document.querySelector('.chartWrapper canvas');
                    if (chart && chart.chart) {
                      chart.chart.resetZoom();
                    }
                  }}
                >
                  🔍 Reset Zoom
                </button>
                {showPredictions && (
                  <button 
                    className="chartBtn active"
                    onClick={() => setShowPredictions(false)}
                  >
                    📈 Hide Predictions
                  </button>
                )}
                {!showPredictions && predictionData && (
                  <button 
                    className="chartBtn"
                    onClick={() => setShowPredictions(true)}
                  >
                    🔮 Show Predictions
                  </button>
                )}
              </div>
              {showPredictions && predictionData && (
                <div className="chartInfo">
                  <span className="chartLabel historical">● Historical Price</span>
                  <span className="chartLabel prediction">● AI Prediction</span>
                  {predictionData.upper_bound && (
                    <span className="chartLabel upper">● Upper Bound</span>
                  )}
                  {predictionData.lower_bound && (
                    <span className="chartLabel lower">● Lower Bound</span>
                  )}
                </div>
              )}
            </div>
            
            <div className="chartContainer">
              {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                  Loading...
                </div>
              ) : chartData.length > 0 && !error ? (
                <Line
                  data={getChartData()}
                  options={getDynamicChartOptions()}
                  redraw
                />
              ) : (
                <img src={fallback} alt="chart fallback" />
              )}
            </div>
          </div>

          {!loading && open != null && current != null && (
            <p className="percentage" style={{ color: isUp ? '#00C805' : '#ff4d4d' }}>
              {isUp ? '+' : ''}{pct.toFixed(2)}%
            </p>
          )}

          <TimeLine range={range} setRange={setRange} />

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
                  🔮 AI Forecast
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
                <div className="predictionMetric">
                  <span className="label">Stock Volatility</span>
                  <span className={`value ${stockVolatility > 0.04 ? 'negative' : stockVolatility > 0.02 ? '' : 'positive'}`}>
                    {(stockVolatility * 100).toFixed(1)}% 
                    {stockVolatility > 0.04 ? ' (High)' : stockVolatility > 0.02 ? ' (Moderate)' : ' (Low)'}
                  </span>
                </div>
              </div>
              
              {predictionData.technical_indicators && (
                <div className="technicalIndicators">
                  <h4>Technical Analysis</h4>
                  <div className="indicatorGrid">
                    <div className="indicator">
                      <span className="label">10-Day SMA</span>
                      <span className="value">${predictionData.technical_indicators.sma_10?.toFixed(2)}</span>
                    </div>
                    <div className="indicator">
                      <span className="label">20-Day SMA</span>
                      <span className="value">${predictionData.technical_indicators.sma_20?.toFixed(2)}</span>
                    </div>
                    <div className="indicator">
                      <span className="label">50-Day SMA</span>
                      <span className="value">${predictionData.technical_indicators.sma_50?.toFixed(2)}</span>
                    </div>
                    <div className="indicator">
                      <span className="label">200-Day SMA</span>
                      <span className="value">${predictionData.technical_indicators.sma_200?.toFixed(2)}</span>
                    </div>
                    <div className="indicator">
                      <span className="label">RSI (14)</span>
                      <span className={`value ${predictionData.technical_indicators.rsi > 70 ? 'negative' : predictionData.technical_indicators.rsi < 30 ? 'positive' : ''}`}>
                        {predictionData.technical_indicators.rsi?.toFixed(1)}
                      </span>
                    </div>
                    <div className="indicator">
                      <span className="label">MACD</span>
                      <span className={`value ${predictionData.technical_indicators.macd >= 0 ? 'positive' : 'negative'}`}>
                        {predictionData.technical_indicators.macd?.toFixed(3)}
                      </span>
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
                    <div className="indicator">
                      <span className="label">Bollinger %B</span>
                      <span className={`value ${predictionData.technical_indicators.bb_percent > 0.8 ? 'negative' : predictionData.technical_indicators.bb_percent < 0.2 ? 'positive' : ''}`}>
                        {(predictionData.technical_indicators.bb_percent * 100)?.toFixed(1)}%
                      </span>
                    </div>
                    <div className="indicator">
                      <span className="label">30-Day Volatility</span>
                      <span className="value">${predictionData.technical_indicators.volatility_30d?.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Model Performance Metrics */}
              {predictionData.model_accuracy && (
                <div className="modelMetrics">
                  <h4>🤖 Model Performance</h4>
                  <div className="indicatorGrid">
                    <div className="indicator">
                      <span className="label">Accuracy Score</span>
                      <span className="value positive">{(predictionData.model_accuracy * 100).toFixed(1)}%</span>
                    </div>
                    <div className="indicator">
                      <span className="label">Confidence</span>
                      <span className="value positive">{predictionData.confidence_score?.toFixed(1)}%</span>
                    </div>
                    <div className="indicator">
                      <span className="label">Mean Error</span>
                      <span className="value">${predictionData.model_mae?.toFixed(2)}</span>
                    </div>
                    <div className="indicator">
                      <span className="label">RMSE</span>
                      <span className="value">${predictionData.model_rmse?.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="predictionDisclaimer">
                <p>⚠️ <strong>Disclaimer:</strong> This is an AI-generated prediction for educational purposes only. Not financial advice. Always do your own research before investing.</p>
              </div>
            </div>
          )}

          {/* Analyst Price Targets */}
          <div className="analystTargetsCard">
            <h3>📊 Analyst Price Targets</h3>
            {priceTargetsLoading ? (
              <div className="targetLoading">Loading analyst targets...</div>
            ) : priceTargetsError ? (
              <div className="targetError">{priceTargetsError}</div>
            ) : priceTargets ? (
              <div className="targetContent">
                <div className="targetSummary">
                  <div className="targetMetric">
                    <span className="label">Last Month Target</span>
                    <span className="value">
                      ${priceTargets.lastMonthAvgPriceTarget?.toFixed(2) || 'N/A'}
                    </span>
                    <span className="subtext">
                      {priceTargets.lastMonthCount || 0} analyst{(priceTargets.lastMonthCount || 0) !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="targetMetric">
                    <span className="label">Last Quarter Target</span>
                    <span className="value">
                      ${priceTargets.lastQuarterAvgPriceTarget?.toFixed(2) || 'N/A'}
                    </span>
                    <span className="subtext">
                      {priceTargets.lastQuarterCount || 0} analyst{(priceTargets.lastQuarterCount || 0) !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="targetMetric">
                    <span className="label">Last Year Target</span>
                    <span className="value">
                      ${priceTargets.lastYearAvgPriceTarget?.toFixed(2) || 'N/A'}
                    </span>
                    <span className="subtext">
                      {priceTargets.lastYearCount || 0} analyst{(priceTargets.lastYearCount || 0) !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="targetMetric">
                    <span className="label">All-Time Average</span>
                    <span className="value">
                      ${priceTargets.allTimeAvgPriceTarget?.toFixed(2) || 'N/A'}
                    </span>
                    <span className="subtext">
                      {priceTargets.allTimeCount || 0} total rating{(priceTargets.allTimeCount || 0) !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                
                {priceTargets.lastMonthAvgPriceTarget && current && (
                  <div className="targetComparison">
                    <div className="timeframeComparison">
                      {[
                        { 
                          label: 'Last Month', 
                          target: priceTargets.lastMonthAvgPriceTarget, 
                          count: priceTargets.lastMonthCount 
                        },
                        { 
                          label: 'Last Quarter', 
                          target: priceTargets.lastQuarterAvgPriceTarget, 
                          count: priceTargets.lastQuarterCount 
                        },
                        { 
                          label: 'Last Year', 
                          target: priceTargets.lastYearAvgPriceTarget, 
                          count: priceTargets.lastYearCount 
                        }
                      ].map(({ label, target, count }) => {
                        if (!target) return null;
                        const upside = ((target - current) / current) * 100;
                        const isPositive = upside > 0;
                        
                        return (
                          <div key={label} className="comparisonRow">
                            <div className="comparisonLabel">
                              <span className="timeframe">{label}</span>
                              <span className="analystCount">({count} analyst{count !== 1 ? 's' : ''})</span>
                            </div>
                            <div className="comparisonValue">
                              <span className="targetPrice">${target.toFixed(2)}</span>
                              <span className={`upside ${isPositive ? 'positive' : 'negative'}`}>
                                {isPositive ? '+' : ''}{upside.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                <div className="targetDisclaimer">
                  <p>💡 <strong>Note:</strong> Price targets represent average analyst expectations across different timeframes. More recent targets may be more relevant for current market conditions.</p>
                </div>
              </div>
            ) : (
              <div className="targetEmpty">No analyst data available for {symbol}</div>
            )}
          </div>

          {/* Analyst Grades & Recommendations */}
          <div className="analystGradesCard">
            <h3>🏆 Recent Analyst Actions</h3>
            {gradesLoading ? (
              <div className="gradesLoading">Loading recent analyst actions...</div>
            ) : gradesError ? (
              <div className="gradesError">{gradesError}</div>
            ) : grades.length > 0 ? (
              <div className="gradesContent">
                <div className="gradesList">
                  {grades.map((grade, index) => {
                    const actionType = grade.action?.toLowerCase();
                    const isUpgrade = actionType === 'upgrade' || 
                      (actionType === 'initiate' && ['buy', 'overweight', 'strong buy'].some(term => 
                        grade.newGrade?.toLowerCase().includes(term)));
                    const isDowngrade = actionType === 'downgrade' || 
                      (actionType === 'initiate' && ['sell', 'underweight', 'strong sell'].some(term => 
                        grade.newGrade?.toLowerCase().includes(term)));
                    
                    return (
                      <div key={index} className="gradeItem">
                        <div className="gradeHeader">
                          <div className="gradeCompany">{grade.gradingCompany}</div>
                          <div className="gradeDate">
                            {new Date(grade.date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </div>
                        </div>
                        
                        <div className="gradeAction">
                          <div className={`actionBadge ${isUpgrade ? 'upgrade' : isDowngrade ? 'downgrade' : 'maintain'}`}>
                            {actionType === 'upgrade' && '📈 Upgrade'}
                            {actionType === 'downgrade' && '📉 Downgrade'}
                            {actionType === 'maintain' && '➡️ Maintain'}
                            {actionType === 'initiate' && '🎯 Initiate'}
                            {!['upgrade', 'downgrade', 'maintain', 'initiate'].includes(actionType) && 
                              `${actionType?.charAt(0).toUpperCase()}${actionType?.slice(1)}`
                            }
                          </div>
                        </div>
                        
                        <div className="gradeDetails">
                          {grade.previousGrade && grade.previousGrade !== grade.newGrade ? (
                            <div className="gradeChange">
                              <span className="previousGrade">{grade.previousGrade}</span>
                              <span className="arrow">→</span>
                              <span className="newGrade">{grade.newGrade}</span>
                            </div>
                          ) : (
                            <div className="gradeStatic">
                              <span className="grade">{grade.newGrade}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <div className="gradesDisclaimer">
                  <p>📋 <strong>Note:</strong> Analyst ratings and actions represent individual firm opinions and should not be considered as investment advice. Always conduct your own research.</p>
                </div>
              </div>
            ) : (
              <div className="gradesEmpty">No recent analyst actions for {symbol}</div>
            )}
          </div>

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