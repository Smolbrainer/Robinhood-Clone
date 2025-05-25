// Newsfeed.js
import React, { useState, useEffect } from "react"
import "./Newsfeed.css"
import Avatar from "@mui/material/Avatar"
import LineGraph from "./LineGraph"
import Chip from "@mui/material/Chip"
import { collection, getDocs } from "firebase/firestore"
import { db } from "./firebase"

const FMP_KEY = process.env.REACT_APP_FMP_KEY || "X5t0qm3ru74kZNRha7rSywlO8At81XrG"

export default function Newsfeed() {
  const [popularTopics] = useState([
    "Technology",
    "Top Movers",
    "Upcoming Earnings",
    "Crypto",
    "Cannabis",
    "Healthcare Supplies",
    "Index ETFs",
    "China",
    "Pharma",
  ])
  const [portfolioValue, setPortfolioValue] = useState(0)
  const [dailyChange, setDailyChange] = useState(0)
  const [dailyPct, setDailyPct] = useState(0)

  useEffect(() => {
    async function fetchPortfolioSummary() {
      // 1) load your stocks from Firestore
      const snap = await getDocs(collection(db, "myStocks"))
      const stocks = snap.docs.map((d) => ({
        ticker: d.data().ticker,
        shares: parseFloat(d.data().shares),
      }))
      if (stocks.length === 0) {
        setPortfolioValue(0)
        setDailyChange(0)
        setDailyPct(0)
        return
      }

      // 2) batch-request quotes from FMP
      const symbols = stocks.map((h) => h.ticker).join(",")
      const res = await fetch(
        `https://financialmodelingprep.com/api/v3/quote/${symbols}?apikey=${FMP_KEY}`
      )
      const quotes = await res.json() // array of { symbol, price, previousClose, ... }

      // 3) compute totals
      let total = 0
      let prevTotal = 0
      stocks.forEach(({ ticker, shares }) => {
        const q = quotes.find((q) => q.symbol === ticker) || {}
        const current = q.price ?? 0
        const prevClose = q.previousClose ?? current
        total += current * shares
        prevTotal += prevClose * shares
      })

      const change = total - prevTotal
      const pct = prevTotal ? (change / prevTotal) * 100 : 0

      setPortfolioValue(total)
      setDailyChange(change)
      setDailyPct(pct)
    }

    fetchPortfolioSummary()
  }, [])

  return (
    <div className="newsfeed">
      <div className="newsfeed__container">
        <div className="newsfeed__chart__section">
          <div className="newsfeed_price_asset">
            <h1>
              $
              {portfolioValue.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </h1>
            <p>
              ${dailyChange >= 0 ? "+" : ""}
              {dailyChange.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              ({dailyPct >= 0 ? "+" : ""}
              {dailyPct.toFixed(2)}%) Today
            </p>
          </div>
          <div className="newsfeed__chart">
            <LineGraph />
          </div>
        </div>

        <div className="newsfeed__buying__section">
          <h2> Buying Power</h2>
          <h2> $4.11</h2>
        </div>

        <div className="newsfeed__market__section">
          <div className="newsfeed__market__box">
            <p> Markets Closed</p>
            <h1> Happy Thanksgiving</h1>
          </div>
        </div>

        <div className="newsfeed__popularlists__section">
          <div className="newsfeed__popularlists__intro">
            <h1>Popular lists</h1>
            <p>Show More</p>
          </div>
          <div className="newsfeed__popularlists__badges">
            {popularTopics.map((topic) => (
              <Chip
                key={topic}
                className="topic__badge"
                variant="outlined"
                label={topic}
                avatar={
                  <Avatar
                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(
                      topic
                    )}&background=random&size=32`}
                  />
                }
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
