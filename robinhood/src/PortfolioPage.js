// PortfolioPage.js
import React, { useState, useEffect } from 'react'
import Header from './Header'
import { collection, getDocs } from 'firebase/firestore'
import { db } from './firebase'
import { useNavigate } from 'react-router-dom'
import './PortfolioPage.css'

const FMP_KEY = process.env.REACT_APP_FMP_KEY || 'X5t0qm3ru74kZNRha7rSywlO8At81XrG'

export default function PortfolioPage() {
  const [holdings, setHoldings] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function loadPortfolio() {
      // 1) load your stocks from Firestore
      const snap = await getDocs(collection(db, 'myStocks'))
      const stocks = snap.docs.map(d => ({
        ticker: d.data().ticker,
        shares: parseFloat(d.data().shares),
      }))
      if (stocks.length === 0) {
        setHoldings([])
        setLoading(false)
        return
      }

      // helper: try Yahoo first, otherwise FMP
      async function fetchQuotes(symbols) {
        const yahooUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}`
        try {
          const r = await fetch(yahooUrl)
          if (!r.ok) throw new Error('Yahoo failed')
          const j = await r.json()
          return j.quoteResponse.result
        } catch {
          // fallback to Financial Modeling Prep
          return Promise.all(
            symbols.split(',').map(async sym => {
              const r2 = await fetch(
                `https://financialmodelingprep.com/api/v3/quote/${sym}?apikey=${FMP_KEY}`
              )
              const [q] = await r2.json()
              return {
                symbol: q.symbol,
                regularMarketPrice: q.price,
                regularMarketPreviousClose: q.previousClose,
              }
            })
          )
        }
      }

      // 2) batch-request all tickers
      const symbols = stocks.map(h => h.ticker).join(',')
      const quotes = await fetchQuotes(symbols)

      // 3) merge quote data into your holdings
      const enriched = stocks.map(h => {
        const q = quotes.find(r => r.symbol === h.ticker) || {}
        const current = q.regularMarketPrice ?? 0
        const prevClose = q.regularMarketPreviousClose ?? current
        const pctChange = prevClose
          ? ((current - prevClose) / prevClose) * 100
          : 0
        return {
          ...h,
          current,
          prevClose,
          pctChange,
          value: h.shares * current,
        }
      })

      setHoldings(enriched)
      setLoading(false)
    }

    loadPortfolio()
  }, [])

  if (loading) {
    return (
      <>
        <div className="portfolioPage">Loading your portfolio…</div>
      </>
    )
  }

  // calculate totals
  const totalValue = holdings.reduce((sum, h) => sum + h.value, 0)
  const totalGain = holdings.reduce(
    (sum, h) => sum + h.shares * (h.current - h.prevClose),
    0
  )
  const totalPct =
    totalValue > 0 ? (totalGain / (totalValue - totalGain)) * 100 : 0

  return (
    <>
      <div className="portfolioPage">
        <div className="portfolioSummary">
          <h2>Portfolio Value</h2>
          <p className="totalValue">${totalValue.toFixed(2)}</p>
          <p className={'totalChange ' + (totalGain >= 0 ? 'positive' : 'negative')}>
            {totalGain >= 0 ? '+' : ''}
            ${totalGain.toFixed(2)} ({totalPct.toFixed(2)}%)
          </p>
        </div>

        <table className="holdingsTable">
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Shares</th>
              <th>Price</th>
              <th>Value</th>
              <th>Day %Δ</th>
            </tr>
          </thead>
          <tbody>
            {holdings.map(h => (
              <tr
                key={h.ticker}
                onClick={() => navigate(`/stock/${h.ticker}`)}
                style={{ cursor: 'pointer' }}
              >
                <td>{h.ticker}</td>
                <td>{h.shares}</td>
                <td>${h.current.toFixed(2)}</td>
                <td>${h.value.toFixed(2)}</td>
                <td className={h.pctChange >= 0 ? 'positive' : 'negative'}>
                  {h.pctChange >= 0 ? '+' : ''}
                  {h.pctChange.toFixed(2)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
