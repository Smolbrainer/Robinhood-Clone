import React from 'react';
import { useNavigate } from 'react-router-dom';
import './StockCard.css';

export default function StockCard({ stock }) {
  const navigate = useNavigate();
  const isUp = parseFloat(stock.changesPercentage) >= 0;

  return (
    <div 
      className="stock-card"
      onClick={() => navigate(`/stock/${stock.ticker || stock.symbol}`)}
    >
      <div className="stock-card__header">
        <h3>{stock.ticker || stock.symbol}</h3>
        <p className="stock-card__name">{stock.companyName || stock.name}</p>
      </div>
      <div className="stock-card__price">
        <p className="stock-card__current">${parseFloat(stock.price).toFixed(2)}</p>
        <p 
          className="stock-card__change"
          style={{ color: isUp ? '#5AC53B' : '#ff4d4d' }}
        >
          {isUp ? '+' : ''}{parseFloat(stock.changesPercentage).toFixed(2)}%
        </p>
      </div>
    </div>
  );
} 