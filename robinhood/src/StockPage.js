import React, { useState, useEffect, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Line } from 'react-chartjs-2'
import TimeLine from './TimeLine'
import './StockPage.css'

import StockChart from './stock.svg'
import StockChart2 from './stock2.svg'
import negativeStockChart2 from './negStock.svg'
import { db } from './firebase'
import { doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore'

const FMP_KEY = process.env.REACT_APP_FMP_KEY || 'X5t0qm3ru74kZNRha7rSywlO8At81XrG';

const sparkOptions = {
  plugins: { legend: { display: false }, tooltip: { enabled: false } },
  scales: {
    x: { display: false, type: 'time', time: { unit: 'day' } },
    y: { display: false },
  },
  elements: { line: { tension: 0.3, borderWidth: 1.5 }, point: { radius: 1 } },
  maintainAspectRatio: false,
}

const RANGE_DAYS = {
  LIVE: 1,
  '1D': 1,
  '1W': 7,
  '3M': 90,
  '1Y': 365,
  ALL: null,
}

export default function StockPage() {
  const { symbol } = useParams()
  const navigate = useNavigate()
  const [quote, setQuote] = useState({ open: 0, price: 0 })
  const [chartData, setChartData] = useState([])
  const [error, setError] = useState(false)
  const [sharesToBuy, setSharesToBuy] = useState(1)
  const [buying, setBuying] = useState(false)
  const [range, setRange] = useState('1W')

  useEffect(() => {
    async function fetchQuote() {
      try {
        const res = await fetch(
          `https://financialmodelingprep.com/api/v3/quote/${symbol}?apikey=${FMP_KEY}`
        )
        const data = await res.json()
        const q = data[0] || {}
        setQuote({ open: q.open ?? 0, price: q.price ?? 0 })
      } catch {
        // ignore
      }
    }
    fetchQuote()
  }, [symbol])

  useEffect(() => {
    async function fetchChart() {
      setError(false)
      try {
        const days = RANGE_DAYS[range]
        let url =
          `https://financialmodelingprep.com/api/v3/historical-price-full/${symbol}`
        if (days) url += `?timeseries=${days}`
        url += `&apikey=${FMP_KEY}`

        const res = await fetch(url)
        const json = await res.json()
        const hist = json.historical || []
        if (hist.length) {
          const pts = hist
            .slice()
            .reverse()
            .map(({ date, close }) => ({ x: new Date(date), y: close }))
          setChartData(pts)
        } else {
          setChartData([])
          setError(true)
        }
      } catch (err) {
        console.error('Chart fetch error:', err)
        setError(true)
      }
    }
    fetchChart()
  }, [symbol, range])

  const { open, price: current } = quote
  const pct = open ? ((current - open) / open) * 100 : 0
  const isUp = pct >= 0

  const fallback = useMemo(() => {
    if (!isUp) return negativeStockChart2
    return Math.random() < 0.5 ? StockChart : StockChart2
  }, [isUp])

  async function handleBuy(e) {
    e.preventDefault()
    setBuying(true)
    try {
      const stockRef = doc(db, 'myStocks', symbol)
      const snap = await getDoc(stockRef)
      if (snap.exists()) {
        await updateDoc(stockRef, { shares: increment(sharesToBuy) })
      } else {
        await setDoc(stockRef, { ticker: symbol, shares: sharesToBuy })
      }
      alert(`Bought ${sharesToBuy} share(s) of ${symbol}!`)
    } catch (err) {
      console.error(err)
      alert('Purchase failed. Please try again.')
    } finally {
      setBuying(false)
    }
  }

  return (
    <>
      <div className="stockPage">
        <aside className="leftPanel">
          <div className="backLink">
            <Link to="/">← Back to Home</Link>
          </div>
          <h2 className="symbolTitle">{symbol}</h2>

          <div className="chartWrapper">
            {chartData.length > 0 && !error ? (
              <Line
                data={{ datasets: [{ data: chartData, borderColor: isUp ? '#5AC53B' : '#E74C3C', fill: false }] }}
                options={sparkOptions}
                redraw
              />
            ) : (
              <img src={fallback} alt="chart fallback" />
            )}
          </div>

          {open != null && current != null && (
            <p className="percentage" style={{ color: isUp ? '#5AC53B' : '#E74C3C' }}>
              {isUp ? '+' : ''}{pct.toFixed(2)}%
            </p>
          )}

          <TimeLine range={range} setRange={setRange} />

          <div className="aboutCard">
            <h3>About {symbol}</h3>
            <ul>
              <li>Market Cap: $1.2T</li>
              <li>P/E Ratio: 24.5</li>
              <li>Volume: 3.4M</li>
              <li>52-Week High: $250.00</li>
              <li>52-Week Low: $180.00</li>
            </ul>
          </div>
        </aside>

        <aside className="rightPanel">
          <div className="buyCard">
            <h3>Buy {symbol}</h3>
            <form onSubmit={handleBuy}>
              <label>
                Shares:
                <input
                  type="number"
                  min="1"
                  value={sharesToBuy}
                  onChange={e => setSharesToBuy(+e.target.value)}
                />
              </label>
              <button type="submit" disabled={buying}>
                {buying ? 'Processing…' : 'Buy'}
              </button>
            </form>
          </div>
        </aside>
      </div>
    </>
  )
}