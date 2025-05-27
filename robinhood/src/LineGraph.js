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

// map your timeline labels to days
const RANGE_DAYS = {
  LIVE: 1,
  '1D': 1,
  '1W': 7,
  '3M': 90,
  '1Y': 365,
}

const options = {
  plugins: { 
    legend: { display: false }, 
    tooltip: { 
      mode: 'index', 
      intersect: false,
      callbacks: {
        label: function(context) {
          return `$${context.parsed.y.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })}`;
        }
      }
    } 
  },
  interaction: { mode: 'index', intersect: false },
  elements: { line: { tension: 0.3 }, point: { radius: 2 } },
  maintainAspectRatio: false,
  scales: {
    x: { 
      type: 'time', 
      time: { unit: 'day', tooltipFormat: 'll' }, 
      ticks: { display: true } 
    },
    y: { 
      grid: { display: true }, 
      ticks: { 
        display: true,
        callback: function(value) {
          return '$' + value.toLocaleString();
        }
      } 
    },
  },
}

export default function LineGraph() {
  const [points, setPoints] = useState([])
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState('1W')
  const { currentUser } = useAuth()

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
      } catch (error) {
        console.error('Error building portfolio history:', error);
        setPoints([]);
      } finally {
        setLoading(false);
      }
    }

    buildSeries();
  }, [currentUser, range]);

  if (loading) return <div className="lineGraph">Loading portfolio history…</div>;

  return (
    <div className="lineGraphContainer">
      <div className="lineGraph" style={{ height: 300 }}>
        {points.length > 0 ? (
          <Line 
            data={{ 
              datasets: [{ 
                data: points, 
                borderColor: '#5AC53B',
                backgroundColor: 'rgba(90, 197, 59, 0.1)',
                fill: true
              }] 
            }}
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