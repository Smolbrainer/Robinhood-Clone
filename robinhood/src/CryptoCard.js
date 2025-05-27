import React from 'react';
import './CryptoCard.css';

function CryptoCard({ crypto }) {
  const priceChange = crypto.price - crypto.previousClose;
  const percentChange = (priceChange / crypto.previousClose) * 100;
  const isPositive = priceChange >= 0;

  return (
    <div className="cryptoCard">
      <div className="cryptoCard__header">
        <div className="cryptoCard__symbol">{crypto.symbol}</div>
        <div className={`cryptoCard__change ${isPositive ? 'positive' : 'negative'}`}>
          {isPositive ? '+' : ''}{percentChange.toFixed(2)}%
        </div>
      </div>
      <div className="cryptoCard__price">
        ${crypto.price.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </div>
      <div className="cryptoCard__volume">
        24h Vol: ${crypto.volume.toLocaleString()}
      </div>
    </div>
  );
}

export default CryptoCard; 