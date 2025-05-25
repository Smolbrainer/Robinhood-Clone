// LineGraph.js
import React, { useEffect, useState } from 'react'
import { Chart as ChartJS, registerables } from 'chart.js'
import 'chartjs-adapter-moment'
import { Line } from 'react-chartjs-2'
import './LineGraph.css'
import TimeLine from './TimeLine'
import { collection, getDocs } from 'firebase/firestore'
import { db } from './firebase'

ChartJS.register(...registerables)

const FMP_KEY = process.env.REACT_APP_FMP_KEY || 'X5t0qm3ru74kZNRha7rSywlO8At81XrG'

// map your timeline labels to days (LIVE treated as 1D)
const RANGE_DAYS = {
  LIVE: 1,
  '1D': 1,
  '1W': 7,
  '3M': 90,
  '1Y': 365,
}

const options = {
  plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
  interaction: { mode: 'index', intersect: false },
  elements: { line: { tension: 0.3 }, point: { radius: 2 } },
  maintainAspectRatio: false,
  scales: {
    x: { type: 'time', time: { unit: 'day', tooltipFormat: 'll' }, ticks: { display: true } },
    y: { grid: { display: true }, ticks: { display: true } },
  },
}

export default function LineGraph() {
  const [points, setPoints] = useState([])
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState('1W')

  useEffect(() => {
    async function buildSeries() {
      setLoading(true)

      // 1) load holdings
      const snap = await getDocs(collection(db, 'myStocks'))
      const holdings = snap.docs.map(d => ({
        ticker: d.data().ticker,
        shares: parseFloat(d.data().shares),
      }))
      if (holdings.length === 0) {
        setPoints([])
        return setLoading(false)
      }

      const days = RANGE_DAYS[range]
      // 2) fetch history for each
      const allSeries = await Promise.all(
        holdings.map(async ({ ticker, shares }) => {
          // for ALL, omit timeseries param
          const url =
            `https://financialmodelingprep.com/api/v3/historical-price-full/${ticker}` +
            (range === 'ALL' ? '' : `?timeseries=${days}`) +
            `&apikey=${FMP_KEY}`

          const res = await fetch(url)
          const { historical = [] } = await res.json()
          return historical.map(({ date, close }) => ({
            time: new Date(date),
            value: shares * close,
          }))
        })
      )

      // 3) aggregate per date
      const agg = {}
      allSeries.forEach(series =>
        series.forEach(({ time, value }) => {
          const key = time.getTime()
          agg[key] = (agg[key] || 0) + value
        })
      )

      // 4) build sorted points
      const pts = Object.entries(agg)
        .map(([ms, val]) => ({ x: new Date(+ms), y: val }))
        .sort((a, b) => a.x - b.x)

      setPoints(pts)
      setLoading(false)
    }

    buildSeries()
  }, [range])

  if (loading) return <div className="lineGraph">Loading portfolio history…</div>

  return (
    <div className="lineGraphContainer">
      <div className="lineGraph" style={{ height: 300 }}>
        {points.length > 0 ? (
          <Line data={{ datasets: [{ data: points, borderColor: '#5AC53B', fill: false }] }}
                options={options} redraw />
        ) : (
          <p>No data to display.</p>
        )}
        <TimeLine range={range} setRange={setRange} />
      </div>
    </div>
  )
}