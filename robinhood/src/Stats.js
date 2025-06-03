// Stats.js
import React, { useState, useEffect } from "react";
import "./Stats.css";
import StatsRow from "./StatsRow";
import { useAuth } from "./AuthContext";
import { getUserPortfolio, getOptionsPositions } from "./userData";

const FMP_KEY = process.env.REACT_APP_FMP_KEY || "X5t0qm3ru74kZNRha7rSywlO8At81XrG";

// Popular stocks to track
const POPULAR_STOCKS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'AMD', 'NFLX', 'DIS'];

export default function Stats() {
  const [stocksData, setStocksData] = useState([]);
  const [portfolio, setPortfolio] = useState(null);
  const [optionsPositions, setOptionsPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const { currentUser } = useAuth();

  useEffect(() => {
    async function loadData() {
      if (!currentUser) return;

      try {
        setLoading(true);
        // Load user's portfolio and options positions
        const [userPortfolio, optionsData] = await Promise.all([
          getUserPortfolio(currentUser.uid),
          getOptionsPositions(currentUser.uid)
        ]);
        
        setPortfolio(userPortfolio);
        setOptionsPositions(optionsData || []);

        // Fetch quotes for all stocks
        const symbols = [
          ...(userPortfolio?.stocks?.map(s => s.symbol) || []),
          ...(userPortfolio?.watchlist || []),
          ...POPULAR_STOCKS
        ].filter((value, index, self) => self.indexOf(value) === index);

        const response = await fetch(
          `https://financialmodelingprep.com/api/v3/quote/${symbols.join(',')}?apikey=${FMP_KEY}`
        );
        const quotes = await response.json();
        const quotesMap = quotes.reduce((acc, quote) => {
          acc[quote.symbol] = quote;
          return acc;
        }, {});

        // My Stocks (owned)
        let myStocks = [];
        if (userPortfolio?.stocks?.length > 0) {
          myStocks = userPortfolio.stocks.map(holding => {
            const quote = quotesMap[holding.symbol] || {};
            return {
              name: holding.symbol,
              shares: holding.shares,
              o: quote.open || 0,
              c: quote.price || 0,
              change: quote.changesPercentage || 0
            };
          }).filter(stock => stock.shares > 0);
        }

        // Wishlist (watchlist, not already owned)
        let wishlist = [];
        if (userPortfolio?.watchlist?.length > 0) {
          wishlist = userPortfolio.watchlist
            .filter(symbol => !myStocks.find(s => s.name === symbol))
            .map(symbol => {
              const quote = quotesMap[symbol] || {};
              return {
                name: symbol,
                shares: 0,
                o: quote.open || 0,
                c: quote.price || 0,
                change: quote.changesPercentage || 0
              };
            });
        }

        setStocksData({ myStocks, wishlist });
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
    // Refresh data every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [currentUser]);

  if (loading) {
    return <div className="stats">Loading...</div>;
  }

  // Calculate portfolio totals
  const stocksValue = stocksData.myStocks?.reduce((sum, stock) => sum + (stock.c * stock.shares), 0) || 0;
  const optionsValue = optionsPositions?.reduce((sum, opt) => sum + (opt.currentValue || 0), 0) || 0;
  const cashValue = portfolio?.cash || 0;
  const totalPortfolioValue = stocksValue + optionsValue + cashValue;

  const stocksGain = stocksData.myStocks?.reduce((sum, stock) => sum + ((stock.c - stock.o) * stock.shares), 0) || 0;
  const optionsGain = optionsPositions?.reduce((sum, opt) => sum + (opt.unrealizedPnL || 0), 0) || 0;
  const totalGain = stocksGain + optionsGain;

  return (
    <div className="stats">
      <div className="stats__container">
        {/* Portfolio Summary */}
        <div className="stats__portfolio">
          <div className="portfolio-summary">
            <div className="portfolio-value">
              <span className="label">Portfolio Value</span>
              <span className="value">${totalPortfolioValue.toFixed(2)}</span>
              <span className={`change ${totalGain >= 0 ? 'positive' : 'negative'}`}>
                {totalGain >= 0 ? '+' : ''}${Math.abs(totalGain).toFixed(2)}
              </span>
            </div>
            <div className="cash-balance">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span>Stocks:</span>
                <span>${stocksValue.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span>Options:</span>
                <span>${optionsValue.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid #42494d' }}>
                <span>Cash:</span>
                <span>${cashValue.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        <h2>My Stocks</h2>
        <div className="stats__rows">
          {stocksData.myStocks?.length === 0 && <p>No stocks owned yet.</p>}
          {stocksData.myStocks?.map((stock) => (
            <StatsRow
              key={stock.name}
              symbol={stock.name}
              openPrice={stock.o}
              price={stock.c}
              shares={stock.shares}
              change={stock.change}
            />
          ))}
        </div>

        {/* Options Summary */}
        {optionsPositions.length > 0 && (
          <>
            <h2 style={{marginTop: '2em'}}>My Options</h2>
            <div className="stats__rows">
              {optionsPositions.map((option, index) => (
                <div key={option.id || index} className="row">
                  <div className="row__intro">
                    <h1>{option.symbol}</h1>
                    <p className="row__shares">
                      {option.type?.toUpperCase()} ${option.strike} {option.expiration}
                    </p>
                  </div>
                  <div className="row__numbers">
                    <p className="row__price">${(option.currentValue || 0).toFixed(2)}</p>
                    <p className={`row__percentage ${(option.unrealizedPnL || 0) >= 0 ? 'positive' : 'negative'}`}>
                      {(option.unrealizedPnL || 0) >= 0 ? '+' : ''}${Math.abs(option.unrealizedPnL || 0).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        
        <h2 style={{marginTop: '2em'}}>My Wishlist</h2>
        <div className="stats__rows">
          {stocksData.wishlist?.length === 0 && <p>No stocks in wishlist.</p>}
          {stocksData.wishlist?.map((stock) => (
            <StatsRow
              key={stock.name}
              symbol={stock.name}
              openPrice={stock.o}
              price={stock.c}
              shares={stock.shares}
              change={stock.change}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
