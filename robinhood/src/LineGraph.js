// LineGraph.js
import React, { useEffect, useState } from 'react'
import { Chart as ChartJS, registerables } from 'chart.js'
import 'chartjs-adapter-moment'
import { Line } from 'react-chartjs-2'
import './LineGraph.css'
import TimeLine from './TimeLine'
import { useAuth } from './AuthContext'
import { getUserPortfolio } from './userData'

ChartJS.register(...registerables)

const FMP_KEY = process.env.REACT_APP_FMP_KEY || 'X5t0qm3ru74kZNRha7rSywlO8At81XrG'
const PREDICTION_API_URL = 'http://localhost:5000'

// map your timeline labels to days
const RANGE_DAYS = {
  LIVE: 1,
  '1D': 1,
  '1W': 7,
  '3M': 90,
  '1Y': 365,
  'PRED': 365 // New range for predictions
}

const options = {
  plugins: { 
    legend: { 
      display: true,
      labels: {
        usePointStyle: true,
        font: {
          family: 'system-ui',
          size: 12
        }
      }
    }, 
    tooltip: { 
      mode: 'index', 
      intersect: false,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      titleColor: '#ffffff',
      bodyColor: '#ffffff',
      borderColor: '#5AC53B',
      borderWidth: 1,
      callbacks: {
        label: function(context) {
          const label = context.dataset.label || '';
          return `${label}: $${context.parsed.y.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })}`;
        }
      }
    } 
  },
  interaction: { mode: 'index', intersect: false },
  elements: { 
    line: { tension: 0.3 }, 
    point: { radius: 1, hoverRadius: 4 } 
  },
  maintainAspectRatio: false,
  scales: {
    x: { 
      type: 'time', 
      time: { unit: 'day', tooltipFormat: 'll' }, 
      ticks: { 
        display: true,
        color: '#888'
      },
      grid: {
        color: 'rgba(255, 255, 255, 0.1)'
      }
    },
    y: { 
      grid: { 
        display: true,
        color: 'rgba(255, 255, 255, 0.1)'
      }, 
      ticks: { 
        display: true,
        color: '#888',
        callback: function(value) {
          return '$' + value.toLocaleString();
        }
      } 
    },
  },
}

export default function LineGraph() {
  const [points, setPoints] = useState([])
  const [predictionData, setPredictionData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [predictionLoading, setPredictionLoading] = useState(false)
  const [range, setRange] = useState('1W')
  const [showPredictions, setShowPredictions] = useState(false)
  const [predictionError, setPredictionError] = useState(null)
  const { currentUser } = useAuth()

  // Fetch prediction data
  const fetchPredictions = async (symbols) => {
    if (!symbols || symbols.length === 0) return;
    
    setPredictionLoading(true);
    setPredictionError(null);
    
    try {
      const predictions = {};
      
      // Use simple prediction for faster response
      for (const symbol of symbols) {
        try {
          const response = await fetch(`${PREDICTION_API_URL}/predict-simple/${symbol}`);
          if (response.ok) {
            const result = await response.json();
            if (result.success) {
              predictions[symbol] = result.data;
            }
          }
        } catch (error) {
          console.warn(`Failed to get prediction for ${symbol}:`, error);
        }
      }
      
      setPredictionData(predictions);
    } catch (error) {
      console.error('Error fetching predictions:', error);
      setPredictionError('Failed to load predictions');
    } finally {
      setPredictionLoading(false);
    }
  };

  useEffect(() => {
    async function buildSeries() {
      if (!currentUser) return;
      setLoading(true)

      try {
        // Load user's portfolio
        const userPortfolio = await getUserPortfolio(currentUser.uid);
        if (!userPortfolio || !userPortfolio.stocks || userPortfolio.stocks.length === 0) {
          setPoints([]);
          return setLoading(false);
        }

        const days = RANGE_DAYS[range];
        const cash = userPortfolio.cash || 0;

        // Fetch history for each stock
        const allSeries = await Promise.all(
          userPortfolio.stocks.map(async ({ symbol, shares }) => {
            const url = `https://financialmodelingprep.com/api/v3/historical-price-full/${symbol}` +
              (range === 'ALL' ? '' : `?timeseries=${days}`) +
              `&apikey=${FMP_KEY}`;

            const res = await fetch(url);
            const { historical = [] } = await res.json();
            return historical.map(({ date, close }) => ({
              time: new Date(date),
              value: shares * close,
            }));
          })
        );

        // Aggregate values per date
        const agg = {};
        allSeries.forEach(series =>
          series.forEach(({ time, value }) => {
            const key = time.getTime();
            agg[key] = (agg[key] || 0) + value;
          })
        );

        // Add cash to each point
        const pts = Object.entries(agg)
          .map(([ms, val]) => ({ x: new Date(+ms), y: val + cash }))
          .sort((a, b) => a.x - b.x);

        setPoints(pts);

        // Fetch predictions if enabled
        if (showPredictions) {
          const symbols = userPortfolio.stocks.map(stock => stock.symbol);
          fetchPredictions(symbols);
        }
      } catch (error) {
        console.error('Error building portfolio history:', error);
        setPoints([]);
      } finally {
        setLoading(false);
      }
    }

    buildSeries();
  }, [currentUser, range, showPredictions]);

  // Prepare chart data
  const getChartData = () => {
    const datasets = [{
      label: 'Portfolio Value',
      data: points,
      borderColor: '#5AC53B',
      backgroundColor: 'rgba(90, 197, 59, 0.1)',
      fill: true,
      pointRadius: 1,
      pointHoverRadius: 4,
    }];

    // Add prediction data if available and enabled
    if (showPredictions && predictionData && Object.keys(predictionData).length > 0) {
      const lastPoint = points[points.length - 1];
      if (lastPoint) {
        // Aggregate predictions from all stocks
        const predictionPoints = [];
        const firstPrediction = Object.values(predictionData)[0];
        
        if (firstPrediction && firstPrediction.dates) {
          firstPrediction.dates.forEach((date, index) => {
            let totalPredictedValue = 0;
            
            // Sum predictions from all stocks in portfolio
            Object.entries(predictionData).forEach(([symbol, prediction]) => {
              if (prediction.predictions && prediction.predictions[index]) {
                totalPredictedValue += prediction.predictions[index];
              }
            });
            
            predictionPoints.push({
              x: new Date(date),
              y: totalPredictedValue
            });
          });

          // Add prediction line
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
        }
      }
    }

    return { datasets };
  };

  if (loading) return <div className="lineGraph">Loading portfolio history…</div>;

  return (
    <div className="lineGraphContainer">
      <div className="lineGraphHeader">
        <div className="predictionControls">
          <button 
            className={`predictionToggle ${showPredictions ? 'active' : ''}`}
            onClick={() => setShowPredictions(!showPredictions)}
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
          
          {showPredictions && predictionData && (
            <div className="predictionInfo">
              <span className="predictionBadge">
                📈 1-Year Forecast Active
              </span>
            </div>
          )}
        </div>
      </div>
      
      <div className="lineGraph" style={{ height: 350 }}>
        {points.length > 0 ? (
          <Line 
            data={getChartData()}
            options={options} 
            redraw 
          />
        ) : (
          <p>No data to display.</p>
        )}
        <TimeLine range={range} setRange={setRange} />
      </div>
    </div>
  );
}