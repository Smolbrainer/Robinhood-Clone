// Newsfeed.js
import React, { useState, useEffect } from "react"
import "./Newsfeed.css"
import Avatar from "@mui/material/Avatar"
import LineGraph from "./LineGraph"
import Chip from "@mui/material/Chip"
import { useAuth } from "./AuthContext"
import { getUserPortfolio } from "./userData"
import StockCard from './StockCard'
import CryptoCard from './CryptoCard'

const FMP_KEY = process.env.REACT_APP_FMP_KEY || "X5t0qm3ru74kZNRha7rSywlO8At81XrG"
const CRYPTO_SYMBOLS = ['BTCUSD', 'ETHUSD', 'SOLUSD', 'DOGEUSD', 'ADAUSD']

export default function Newsfeed() {
  const [portfolioValue, setPortfolioValue] = useState(0)
  const [dailyChange, setDailyChange] = useState(0)
  const [dailyPct, setDailyPct] = useState(0)
  const [buyingPower, setBuyingPower] = useState(0)
  const { currentUser } = useAuth()
  const [gainers, setGainers] = useState([]);
  const [losers, setLosers] = useState([]);
  const [mostActive, setMostActive] = useState([]);
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentNewsIndex, setCurrentNewsIndex] = useState(0);
  const [cryptoData, setCryptoData] = useState([]);

  useEffect(() => {
    async function fetchPortfolioSummary() {
      if (!currentUser) return;

      try {
        // Load user's portfolio
        const userPortfolio = await getUserPortfolio(currentUser.uid);
        if (!userPortfolio) return;

        // Set buying power
        setBuyingPower(userPortfolio.cash || 0);

        // If no stocks, just show cash balance
        if (!userPortfolio.stocks || userPortfolio.stocks.length === 0) {
          setPortfolioValue(userPortfolio.cash || 0);
          setDailyChange(0);
          setDailyPct(0);
          return;
        }

        // Fetch current quotes
        const symbols = userPortfolio.stocks.map(h => h.symbol).join(",");
        const res = await fetch(
          `https://financialmodelingprep.com/api/v3/quote/${symbols}?apikey=${FMP_KEY}`
        );
        const quotes = await res.json();

        // Calculate portfolio value and changes
        let total = userPortfolio.cash || 0;
        let prevTotal = userPortfolio.cash || 0;
        let dailyChange = 0;

        userPortfolio.stocks.forEach(({ symbol, shares, averagePrice }) => {
          const quote = quotes.find(q => q.symbol === symbol);
          if (quote) {
            const currentValue = quote.price * shares;
            const prevValue = quote.previousClose * shares;
            total += currentValue;
            prevTotal += prevValue;
            dailyChange += (quote.price - quote.previousClose) * shares;
          }
        });

        const pct = prevTotal ? (dailyChange / prevTotal) * 100 : 0;

        setPortfolioValue(total);
        setDailyChange(dailyChange);
        setDailyPct(pct);
      } catch (error) {
        console.error('Error fetching portfolio summary:', error);
      }
    }

    fetchPortfolioSummary();
    // Refresh data every 30 seconds
    const interval = setInterval(fetchPortfolioSummary, 30000);
    return () => clearInterval(interval);
  }, [currentUser]);

  useEffect(() => {
    async function fetchMarketData() {
      try {
        setLoading(true);
        // Fetch biggest gainers
        const gainersResponse = await fetch(
          `https://financialmodelingprep.com/api/v3/stock/gainers?apikey=${FMP_KEY}`
        );
        const gainersData = await gainersResponse.json();
        setGainers(Array.isArray(gainersData?.mostGainerStock) ? gainersData.mostGainerStock : []);

        // Fetch biggest losers
        const losersResponse = await fetch(
          `https://financialmodelingprep.com/api/v3/stock/losers?apikey=${FMP_KEY}`
        );
        const losersData = await losersResponse.json();
        setLosers(Array.isArray(losersData?.mostLoserStock) ? losersData.mostLoserStock : []);

        // Fetch most active
        const activeResponse = await fetch(
          `https://financialmodelingprep.com/api/v3/stock/actives?apikey=${FMP_KEY}`
        );
        const activeData = await activeResponse.json();
        setMostActive(Array.isArray(activeData?.mostActiveStock) ? activeData.mostActiveStock : []);

        // Fetch market news
        const newsResponse = await fetch(
          `https://financialmodelingprep.com/stable/news/general-latest?page=0&limit=20&apikey=${FMP_KEY}`
        );
        const newsData = await newsResponse.json();
        setNews(Array.isArray(newsData) ? newsData : []);

        // Fetch crypto data
        const cryptoPromises = CRYPTO_SYMBOLS.map(symbol =>
          fetch(`https://financialmodelingprep.com/stable/quote?symbol=${symbol}&apikey=${FMP_KEY}`)
            .then(res => res.json())
            .then(data => data[0])
        );

        const cryptoResults = await Promise.all(cryptoPromises);
        setCryptoData(cryptoResults);
      } catch (error) {
        console.error('Error fetching market data:', error);
        setGainers([]);
        setLosers([]);
        setMostActive([]);
        setNews([]);
        setCryptoData([]);
      } finally {
        setLoading(false);
      }
    }

    fetchMarketData();
    // Refresh data every 5 minutes
    const interval = setInterval(fetchMarketData, 300000);
    return () => clearInterval(interval);
  }, []);

  const handlePrevNews = () => {
    setCurrentNewsIndex((prev) => (prev === 0 ? news.length - 1 : prev - 1));
  };

  const handleNextNews = () => {
    setCurrentNewsIndex((prev) => (prev === news.length - 1 ? 0 : prev + 1));
  };

  if (loading) {
    return <div className="newsfeed">Loading market data...</div>;
  }

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
          <h2>Buying Power</h2>
          <h2>${buyingPower.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}</h2>
        </div>

        <div className="newsfeed__section">
          <h2>Market News</h2>
          <div className="newsfeed__news">
            {news.slice(0, 3).map((article, index) => (
              <div key={index} className="newsfeed__article">
                <div className="newsfeed__article__header">
                  <span className="newsfeed__article__source">{article.publisher}</span>
                  <span className="newsfeed__article__time">
                    {new Date(article.publishedDate).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
                <div className="newsfeed__article__content">
                  {article.image && (
                    <div className="newsfeed__article__image">
                      <img src={article.image} alt={article.title} />
                    </div>
                  )}
                  <div className="newsfeed__article__text">
                    <h3 className="newsfeed__article__title">
                      <a href={article.url} target="_blank" rel="noopener noreferrer">
                        {article.title}
                      </a>
                    </h3>
                    <p className="newsfeed__article__summary">{article.text}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="newsfeed__section">
          <h2>Biggest Gainers</h2>
          <div className="newsfeed__cards">
            {gainers.map(stock => (
              <StockCard key={stock.ticker} stock={stock} />
            ))}
          </div>
        </div>

        <div className="newsfeed__section">
          <h2>Biggest Losers</h2>
          <div className="newsfeed__cards">
            {losers.map(stock => (
              <StockCard key={stock.ticker} stock={stock} />
            ))}
          </div>
        </div>

        <div className="newsfeed__section">
          <h2>Most Active</h2>
          <div className="newsfeed__cards">
            {mostActive.map(stock => (
              <StockCard key={stock.ticker} stock={stock} />
            ))}
          </div>
        </div>

        <div className="newsfeed__section">
          <h2>Cryptocurrency</h2>
          <div className="newsfeed__cards">
            {cryptoData.map(crypto => (
              <CryptoCard key={crypto.symbol} crypto={crypto} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
