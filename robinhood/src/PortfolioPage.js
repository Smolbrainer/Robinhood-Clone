// PortfolioPage.js
import React, { useState, useEffect } from 'react'
import Header from './Header'
import { useNavigate } from 'react-router-dom'
import './PortfolioPage.css'
import { useAuth } from './AuthContext'
import { getUserPortfolio, getOptionsPositions } from './userData'

const FMP_KEY = process.env.REACT_APP_FMP_KEY || 'X5t0qm3ru74kZNRha7rSywlO8At81XrG'

export default function PortfolioPage() {
  const [holdings, setHoldings] = useState([])
  const [optionsHoldings, setOptionsHoldings] = useState([])
  const [loading, setLoading] = useState(true)
  const [portfolio, setPortfolio] = useState(null)
  const [activeTab, setActiveTab] = useState('stocks') // 'stocks' or 'options'
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
        
        // Load user's portfolio from Firestore and options positions
        const [userPortfolio, optionsPositions] = await Promise.all([
          getUserPortfolio(currentUser.uid),
          getOptionsPositions(currentUser.uid)
        ]);
        
        console.log('Loaded portfolio:', userPortfolio);
        console.log('Loaded options positions:', optionsPositions);
        
        setPortfolio(userPortfolio);
        setOptionsHoldings(optionsPositions || []);

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
        <div className="portfolioPage">
          <div className="loading">Loading your portfolio…</div>
        </div>
      </>
    );
  }

  // Calculate totals including options
  const stocksValue = holdings.reduce((sum, h) => sum + h.value, 0);
  const optionsValue = optionsHoldings.reduce((sum, opt) => sum + (opt.currentValue || 0), 0);
  const totalValue = stocksValue + optionsValue + (portfolio?.cash || 0);
  
  const stocksGain = holdings.reduce((sum, h) => sum + h.gain, 0);
  const optionsGain = optionsHoldings.reduce((sum, opt) => sum + (opt.unrealizedPnL || 0), 0);
  const totalGain = stocksGain + optionsGain;
  
  const totalPct = (stocksValue + optionsValue) > 0 
    ? (totalGain / (stocksValue + optionsValue - totalGain)) * 100 
    : 0;

  return (
    <>
      <div className="portfolioPage">
        <div className="portfolioSummary">
          
          <div className="portfolioMainSection">
            <div className="leftSection">
              <div className="statItem">
                <span className="statLabel">Stocks</span>
                <span className="statValue">${stocksValue.toFixed(2)}</span>
              </div>
              <div className="statItem">
                <span className="statLabel">Today's Change</span>
                <span className={`statValue ${totalGain >= 0 ? 'positive' : 'negative'}`}>
                  {totalGain >= 0 ? '+' : ''}${Math.abs(totalGain).toFixed(2)}
                </span>
              </div>
            </div>
            
            <div className="centerSection">
              <div className="totalValue">${totalValue.toFixed(2)}</div>
              <div className={'totalChange ' + (totalGain >= 0 ? 'positive' : 'negative')}>
                {totalGain >= 0 ? '+' : ''}
                ${Math.abs(totalGain).toFixed(2)} ({Math.abs(totalPct).toFixed(2)}%)
              </div>
            </div>
            
            <div className="rightSection">
              <div className="statItem">
                <span className="statLabel">Options</span>
                <span className="statValue">${optionsValue.toFixed(2)}</span>
              </div>
              <div className="cashBalance">
                Cash: ${portfolio?.cash?.toFixed(2) || '0.00'}
              </div>
            </div>
          </div>
        </div>

        {/* Portfolio Tabs */}
        <div className="portfolioTabs">
          <button 
            className={`tabBtn ${activeTab === 'stocks' ? 'active' : ''}`}
            onClick={() => setActiveTab('stocks')}
          >
            📈 Stocks ({holdings.length})
          </button>
          <button 
            className={`tabBtn ${activeTab === 'options' ? 'active' : ''}`}
            onClick={() => setActiveTab('options')}
          >
            ⚡ Options ({optionsHoldings.length})
          </button>
        </div>

        {/* Stocks Tab */}
        {activeTab === 'stocks' && (
          <>
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
          </>
        )}

        {/* Options Tab */}
        {activeTab === 'options' && (
          <>
            {optionsHoldings.length > 0 ? (
              <table className="holdingsTable">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Option</th>
                    <th>Contracts</th>
                    <th>Cost Basis</th>
                    <th>Current Value</th>
                    <th>P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {optionsHoldings.map((opt, index) => (
                    <tr key={opt.id || index}>
                      <td>{opt.symbol}</td>
                      <td>
                        <div className="optionInfo">
                          <span className={`optionType ${opt.type}`}>
                            {opt.type?.toUpperCase()}
                          </span>
                          <span>${opt.strike} {opt.expiration}</span>
                        </div>
                      </td>
                      <td>{opt.contracts}</td>
                      <td>${(opt.costBasis || 0).toFixed(2)}</td>
                      <td>${(opt.currentValue || 0).toFixed(2)}</td>
                      <td className={(opt.unrealizedPnL || 0) >= 0 ? 'positive' : 'negative'}>
                        {(opt.unrealizedPnL || 0) >= 0 ? '+' : ''}
                        ${Math.abs(opt.unrealizedPnL || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="noHoldings">
                <p>You don't have any options positions yet.</p>
                <p>Start trading options to see them here!</p>
                <button onClick={() => navigate('/options')}>Trade Options</button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
