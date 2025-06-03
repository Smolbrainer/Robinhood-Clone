import React, { useState, useEffect } from 'react'
import './OptionsTrading.css'
import { useAuth } from './AuthContext'
import { getUserPortfolio, buyOption, sellOption } from './userData'

export default function OptionsTrading({ selectedOption, currentPrice, symbol }) {
  const { currentUser } = useAuth()
  const [portfolio, setPortfolio] = useState(null)
  const [orderType, setOrderType] = useState('buy') // buy, sell
  const [contracts, setContracts] = useState(1)
  const [orderStyle, setOrderStyle] = useState('market') // market, limit
  const [limitPrice, setLimitPrice] = useState('')
  const [trading, setTrading] = useState(false)
  const [tradeError, setTradeError] = useState('')
  const [tradeSuccess, setTradeSuccess] = useState('')

  // Load user portfolio
  useEffect(() => {
    async function loadPortfolio() {
      if (!currentUser) return
      const userPortfolio = await getUserPortfolio(currentUser.uid)
      setPortfolio(userPortfolio)
    }
    loadPortfolio()
  }, [currentUser])

  // Reset states when option changes
  useEffect(() => {
    setTradeError('')
    setTradeSuccess('')
    setLimitPrice('')
    if (selectedOption && orderStyle === 'limit') {
      setLimitPrice(selectedOption.lastPrice?.toFixed(2) || '')
    }
  }, [selectedOption])

  if (!currentUser) {
    return (
      <div className="optionsTrading">
        <div className="authRequired">
          <h3>🔐 Sign in Required</h3>
          <p>Please sign in to trade options.</p>
        </div>
      </div>
    )
  }

  if (!selectedOption) {
    return (
      <div className="optionsTrading">
        <div className="noSelection">
          <h3>📊 Select an Option</h3>
          <p>Choose an option from the chain to start trading.</p>
          <div className="tradingTips">
            <h4>💡 Trading Tips:</h4>
            <ul>
              <li>Review Greeks before trading</li>
              <li>Consider time decay (Theta)</li>
              <li>Check implied volatility</li>
              <li>Use limit orders for better fills</li>
            </ul>
          </div>
        </div>
      </div>
    )
  }

  const handleTrade = async (e) => {
    e.preventDefault()
    if (!portfolio || !selectedOption) return

    setTrading(true)
    setTradeError('')
    setTradeSuccess('')

    try {
      const premium = orderStyle === 'market' 
        ? selectedOption.lastPrice 
        : parseFloat(limitPrice)
      
      if (!premium || premium <= 0) {
        setTradeError('Invalid premium price')
        return
      }

      const totalCost = premium * contracts * 100 // Options are sold in contracts of 100

      // Check if user has sufficient funds
      if (orderType === 'buy' && totalCost > portfolio.cash) {
        setTradeError('Insufficient funds')
        return
      }

      // Create order
      const order = {
        symbol,
        strike: selectedOption.strike,
        expiration: selectedOption.expiration,
        type: selectedOption.type, // call or put
        contracts: parseInt(contracts),
        premium,
        action: orderType,
        orderStyle,
        timestamp: new Date().toISOString()
      }

      // Execute trade
      if (orderType === 'buy') {
        await buyOption(currentUser.uid, order)
        setTradeSuccess(`✅ Bought ${contracts} ${selectedOption.type} contract(s)`)
      } else {
        await sellOption(currentUser.uid, order)
        setTradeSuccess(`✅ Sold ${contracts} ${selectedOption.type} contract(s)`)
      }

      // Reload portfolio
      const updatedPortfolio = await getUserPortfolio(currentUser.uid)
      setPortfolio(updatedPortfolio)

    } catch (error) {
      console.error('Trade error:', error)
      setTradeError(`Trade failed: ${error.message}`)
    } finally {
      setTrading(false)
    }
  }

  const premium = orderStyle === 'market' 
    ? selectedOption.lastPrice 
    : parseFloat(limitPrice) || 0
  
  const totalCost = premium * contracts * 100
  const bidAskSpread = selectedOption.ask - selectedOption.bid
  const spreadPercent = selectedOption.bid > 0 ? (bidAskSpread / selectedOption.bid) * 100 : 0

  return (
    <div className="optionsTrading">
      <div className="tradingHeader">
        <h3>💰 Options Trading</h3>
        <div className="selectedOptionInfo">
          <div className="optionDetails">
            <span className="optionSymbol">{symbol}</span>
            <span className="optionStrike">${selectedOption.strike}</span>
            <span className={`optionType ${selectedOption.type}`}>
              {selectedOption.type.toUpperCase()}
            </span>
            <span className="optionExpiration">{selectedOption.expiration}</span>
          </div>
          <div className="optionPrice">
            <span className="currentPrice">${selectedOption.lastPrice?.toFixed(2)}</span>
            <span className="bidAsk">
              ${selectedOption.bid?.toFixed(2)} × ${selectedOption.ask?.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      <form onSubmit={handleTrade} className="tradingForm">
        {/* Order Type */}
        <div className="formGroup">
          <label>Order Type:</label>
          <div className="buttonGroup">
            <button
              type="button"
              className={`orderBtn ${orderType === 'buy' ? 'active buy' : ''}`}
              onClick={() => setOrderType('buy')}
            >
              Buy to Open
            </button>
            <button
              type="button"
              className={`orderBtn ${orderType === 'sell' ? 'active sell' : ''}`}
              onClick={() => setOrderType('sell')}
            >
              Sell to Close
            </button>
          </div>
        </div>

        {/* Contracts */}
        <div className="formGroup">
          <label>Contracts:</label>
          <input
            type="number"
            min="1"
            max="100"
            value={contracts}
            onChange={(e) => setContracts(e.target.value)}
            className="contractsInput"
          />
        </div>

        {/* Order Style */}
        <div className="formGroup">
          <label>Order Style:</label>
          <div className="buttonGroup">
            <button
              type="button"
              className={`styleBtn ${orderStyle === 'market' ? 'active' : ''}`}
              onClick={() => setOrderStyle('market')}
            >
              Market
            </button>
            <button
              type="button"
              className={`styleBtn ${orderStyle === 'limit' ? 'active' : ''}`}
              onClick={() => {
                setOrderStyle('limit')
                if (!limitPrice) {
                  setLimitPrice(selectedOption.lastPrice?.toFixed(2) || '')
                }
              }}
            >
              Limit
            </button>
          </div>
        </div>

        {/* Limit Price */}
        {orderStyle === 'limit' && (
          <div className="formGroup">
            <label>Limit Price:</label>
            <div className="priceInput">
              <span className="dollarSign">$</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                placeholder="0.00"
                className="limitPriceInput"
              />
            </div>
          </div>
        )}

        {/* Order Summary */}
        <div className="orderSummary">
          <div className="summaryRow">
            <span>Premium:</span>
            <span>${premium?.toFixed(2)}</span>
          </div>
          <div className="summaryRow">
            <span>Contracts:</span>
            <span>{contracts}</span>
          </div>
          <div className="summaryRow total">
            <span>Total Cost:</span>
            <span>${totalCost.toFixed(2)}</span>
          </div>
          {portfolio && (
            <div className="summaryRow">
              <span>Available Cash:</span>
              <span>${portfolio.cash?.toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Error/Success Messages */}
        {tradeError && (
          <div className="tradeMessage error">
            ⚠️ {tradeError}
          </div>
        )}
        {tradeSuccess && (
          <div className="tradeMessage success">
            {tradeSuccess}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={trading || !premium || (orderType === 'buy' && totalCost > (portfolio?.cash || 0))}
          className={`tradeButton ${orderType}`}
        >
          {trading ? (
            <>
              <div className="spinner small"></div>
              Processing...
            </>
          ) : (
            `${orderType === 'buy' ? 'Buy' : 'Sell'} ${contracts} Contract${contracts > 1 ? 's' : ''}`
          )}
        </button>
      </form>

      {/* Option Greeks */}
      <div className="greeksPanel">
        <h4>📊 Option Greeks</h4>
        <div className="greeksGrid">
          <div className="greekItem">
            <span className="greekLabel">Delta (Δ)</span>
            <span className="greekValue">{selectedOption.delta?.toFixed(3) || '-'}</span>
            <span className="greekDesc">Price sensitivity</span>
          </div>
          <div className="greekItem">
            <span className="greekLabel">Gamma (Γ)</span>
            <span className="greekValue">{selectedOption.gamma?.toFixed(4) || '-'}</span>
            <span className="greekDesc">Delta change rate</span>
          </div>
          <div className="greekItem">
            <span className="greekLabel">Theta (Θ)</span>
            <span className="greekValue">{selectedOption.theta?.toFixed(3) || '-'}</span>
            <span className="greekDesc">Time decay</span>
          </div>
          <div className="greekItem">
            <span className="greekLabel">Vega (ν)</span>
            <span className="greekValue">{selectedOption.vega?.toFixed(3) || '-'}</span>
            <span className="greekDesc">Volatility sensitivity</span>
          </div>
        </div>
      </div>

      {/* Risk Information */}
      <div className="riskPanel">
        <h4>⚠️ Risk Information</h4>
        <div className="riskMetrics">
          <div className="riskItem">
            <span className="riskLabel">Bid-Ask Spread:</span>
            <span className="riskValue">
              ${bidAskSpread.toFixed(2)} ({spreadPercent.toFixed(1)}%)
            </span>
          </div>
          <div className="riskItem">
            <span className="riskLabel">Volume:</span>
            <span className="riskValue">{selectedOption.volume || 0}</span>
          </div>
          <div className="riskItem">
            <span className="riskLabel">Open Interest:</span>
            <span className="riskValue">{selectedOption.openInterest || 0}</span>
          </div>
          <div className="riskItem">
            <span className="riskLabel">Implied Volatility:</span>
            <span className="riskValue">{(selectedOption.impliedVolatility * 100)?.toFixed(1)}%</span>
          </div>
        </div>
        
        <div className="riskWarning">
          <p>⚠️ <strong>Risk Warning:</strong> Options trading involves substantial risk and is not suitable for all investors. You may lose your entire investment.</p>
        </div>
      </div>
    </div>
  )
} 