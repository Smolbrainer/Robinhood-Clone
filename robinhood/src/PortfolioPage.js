// PortfolioPage.js
import React, { useState, useEffect } from 'react'
import Header from './Header'
import { useNavigate } from 'react-router-dom'
import './PortfolioPage.css'
import { useAuth } from './AuthContext'
import { getUserPortfolio } from './userData'

const FMP_KEY = process.env.REACT_APP_FMP_KEY || 'X5t0qm3ru74kZNRha7rSywlO8At81XrG'

export default function PortfolioPage() {
  const [holdings, setHoldings] = useState([])
  const [loading, setLoading] = useState(true)
  const [portfolio, setPortfolio] = useState(null)
  const navigate = useNavigate()
  const { currentUser } = useAuth()

  useEffect(() => {
    async function loadPortfolio() {
      if (!currentUser) {
        console.log('No current user, skipping portfolio load');
        return;
      }

      try {
        console.log('Loading portfolio for user:', currentUser.uid);
        // Load user's portfolio from Firestore
        const userPortfolio = await getUserPortfolio(currentUser.uid);
        console.log('Loaded portfolio:', userPortfolio);
        setPortfolio(userPortfolio);

        if (!userPortfolio || !userPortfolio.stocks || userPortfolio.stocks.length === 0) {
          console.log('No stocks in portfolio');
          setHoldings([]);
          setLoading(false);
          return;
        }

        // Fetch real-time prices for all stocks in portfolio
        const symbols = userPortfolio.stocks.map(stock => stock.symbol).join(',');
        const response = await fetch(`https://financialmodelingprep.com/api/v3/quote/${symbols}?apikey=${FMP_KEY}`);
        const priceData = await response.json();

        // Create a map of current prices
        const currentPrices = {};
        priceData.forEach(stock => {
          currentPrices[stock.symbol] = stock.price;
        });

        // Merge real-time price data into holdings
        const enriched = userPortfolio.stocks.map(h => {
          const current = currentPrices[h.symbol] || 0;
          return {
            ticker: h.symbol,
            shares: h.shares,
            averagePrice: h.averagePrice,
            current,
            value: h.shares * current,
            gain: h.shares * (current - h.averagePrice),
            gainPercent: ((current - h.averagePrice) / h.averagePrice) * 100
          }
        });

        console.log('Enriched holdings:', enriched);
        setHoldings(enriched);
      } catch (error) {
        console.error('Error loading portfolio:', error);
      }
      setLoading(false);
    }

    loadPortfolio();
    // Refresh portfolio data every 30 seconds
    const interval = setInterval(loadPortfolio, 30000);
    return () => clearInterval(interval);
  }, [currentUser]);

  if (loading) {
    return (
      <>
        <Header />
        <div className="portfolioPage">
          <div className="loading">Loading your portfolio…</div>
        </div>
      </>
    );
  }

  // Calculate totals
  const totalValue = holdings.reduce((sum, h) => sum + h.value, 0) + (portfolio?.cash || 0);
  const totalGain = holdings.reduce((sum, h) => sum + h.gain, 0);
  const totalPct = holdings.length > 0 
    ? (totalGain / (totalValue - totalGain)) * 100 
    : 0;

  return (
    <>
      <Header />
      <div className="portfolioPage">
        <div className="portfolioSummary">
          <h2>Portfolio Value</h2>
          <p className="totalValue">${totalValue.toFixed(2)}</p>
          <p className={'totalChange ' + (totalGain >= 0 ? 'positive' : 'negative')}>
            {totalGain >= 0 ? '+' : ''}
            ${Math.abs(totalGain).toFixed(2)} ({Math.abs(totalPct).toFixed(2)}%)
          </p>
          <p className="cashBalance">Cash Balance: ${portfolio?.cash?.toFixed(2) || '0.00'}</p>
        </div>

        {holdings.length > 0 ? (
          <table className="holdingsTable">
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Shares</th>
                <th>Avg. Price</th>
                <th>Current</th>
                <th>Value</th>
                <th>Gain/Loss</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map(h => (
                <tr
                  key={h.ticker}
                  onClick={() => navigate(`/stock/${h.ticker}`)}
                >
                  <td>{h.ticker}</td>
                  <td>{h.shares.toLocaleString()}</td>
                  <td>${h.averagePrice.toFixed(2)}</td>
                  <td>${h.current.toFixed(2)}</td>
                  <td>${h.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className={h.gain >= 0 ? 'positive' : 'negative'}>
                    {h.gain >= 0 ? '+' : ''}
                    ${Math.abs(h.gain).toFixed(2)} ({Math.abs(h.gainPercent).toFixed(2)}%)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="noHoldings">
            <p>You don't have any stocks in your portfolio yet.</p>
            <p>Start your investment journey today!</p>
            <button onClick={() => navigate('/')}>Start Trading</button>
          </div>
        )}
      </div>
    </>
  );
}
