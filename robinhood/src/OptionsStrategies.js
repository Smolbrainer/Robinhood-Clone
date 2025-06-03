import React, { useState, useEffect, useMemo } from 'react'
import './OptionsStrategies.css'

const PREDEFINED_STRATEGIES = [
  {
    id: 'long_call',
    name: 'Long Call',
    description: 'Bullish strategy with unlimited upside potential',
    complexity: 'Beginner',
    maxRisk: 'Premium Paid',
    maxReward: 'Unlimited',
    legs: [
      { action: 'buy', type: 'call', contracts: 1 }
    ]
  },
  {
    id: 'long_put',
    name: 'Long Put',
    description: 'Bearish strategy for falling stock prices',
    complexity: 'Beginner',
    maxRisk: 'Premium Paid',
    maxReward: 'Strike - Premium',
    legs: [
      { action: 'buy', type: 'put', contracts: 1 }
    ]
  },
  {
    id: 'bull_call_spread',
    name: 'Bull Call Spread',
    description: 'Limited risk, limited reward bullish strategy',
    complexity: 'Intermediate',
    maxRisk: 'Net Premium',
    maxReward: 'Strike Difference - Net Premium',
    legs: [
      { action: 'buy', type: 'call', contracts: 1, strike: 'lower' },
      { action: 'sell', type: 'call', contracts: 1, strike: 'higher' }
    ]
  },
  {
    id: 'bear_put_spread',
    name: 'Bear Put Spread',
    description: 'Limited risk, limited reward bearish strategy',
    complexity: 'Intermediate',
    maxRisk: 'Net Premium',
    maxReward: 'Strike Difference - Net Premium',
    legs: [
      { action: 'buy', type: 'put', contracts: 1, strike: 'higher' },
      { action: 'sell', type: 'put', contracts: 1, strike: 'lower' }
    ]
  },
  {
    id: 'long_straddle',
    name: 'Long Straddle',
    description: 'Profit from high volatility in either direction',
    complexity: 'Intermediate',
    maxRisk: 'Total Premium',
    maxReward: 'Unlimited',
    legs: [
      { action: 'buy', type: 'call', contracts: 1 },
      { action: 'buy', type: 'put', contracts: 1 }
    ]
  },
  {
    id: 'iron_condor',
    name: 'Iron Condor',
    description: 'Profit from low volatility, range-bound trading',
    complexity: 'Advanced',
    maxRisk: 'Width - Net Credit',
    maxReward: 'Net Credit',
    legs: [
      { action: 'sell', type: 'put', contracts: 1, strike: 'lower_put' },
      { action: 'buy', type: 'put', contracts: 1, strike: 'lowest' },
      { action: 'sell', type: 'call', contracts: 1, strike: 'higher_call' },
      { action: 'buy', type: 'call', contracts: 1, strike: 'highest' }
    ]
  }
]

export default function OptionsStrategies({ optionsData, selectedExpiration, symbol }) {
  const [selectedStrategy, setSelectedStrategy] = useState(null)
  const [customLegs, setCustomLegs] = useState([])
  const [payoffData, setPayoffData] = useState(null)
  const [selectedStrikes, setSelectedStrikes] = useState({})
  const [showPayoff, setShowPayoff] = useState(false)

  // Available strikes from options data
  const availableStrikes = useMemo(() => {
    if (!optionsData || !selectedExpiration || !optionsData.chains[selectedExpiration]) {
      return []
    }
    
    const chainData = optionsData.chains[selectedExpiration]
    const allStrikes = new Set()
    
    if (chainData.calls) {
      chainData.calls.forEach(call => allStrikes.add(call.strike))
    }
    if (chainData.puts) {
      chainData.puts.forEach(put => allStrikes.add(put.strike))
    }
    
    return Array.from(allStrikes).sort((a, b) => a - b)
  }, [optionsData, selectedExpiration])

  // Calculate payoff diagram
  const calculatePayoff = (strategy, strikes) => {
    if (!optionsData || !selectedExpiration || !availableStrikes.length) return null

    const currentPrice = optionsData.currentPrice
    const chainData = optionsData.chains[selectedExpiration]
    const minStrike = Math.min(...availableStrikes)
    const maxStrike = Math.max(...availableStrikes)
    const priceRange = maxStrike - minStrike
    const stepSize = priceRange / 100

    const payoffPoints = []
    let totalCost = 0

    // Calculate initial cost/credit
    strategy.legs.forEach((leg, index) => {
      const strike = strikes[`strike_${index}`] || availableStrikes[Math.floor(availableStrikes.length / 2)]
      const option = leg.type === 'call' 
        ? chainData.calls?.find(c => c.strike === strike)
        : chainData.puts?.find(p => p.strike === strike)
      
      if (option) {
        const premium = option.lastPrice || option.theoreticalPrice || 0
        totalCost += leg.action === 'buy' ? premium : -premium
      }
    })

    // Generate payoff curve
    for (let price = minStrike - priceRange * 0.2; price <= maxStrike + priceRange * 0.2; price += stepSize) {
      let payoff = -totalCost // Start with initial cost/credit

      strategy.legs.forEach((leg, index) => {
        const strike = strikes[`strike_${index}`] || availableStrikes[Math.floor(availableStrikes.length / 2)]
        
        if (leg.type === 'call') {
          const intrinsicValue = Math.max(0, price - strike)
          payoff += leg.action === 'buy' ? intrinsicValue : -intrinsicValue
        } else {
          const intrinsicValue = Math.max(0, strike - price)
          payoff += leg.action === 'buy' ? intrinsicValue : -intrinsicValue
        }
      })

      payoffPoints.push({ price: price, payoff: payoff })
    }

    return {
      points: payoffPoints,
      initialCost: totalCost,
      breakeven: payoffPoints.find(p => Math.abs(p.payoff) < 0.1)?.price || currentPrice,
      maxProfit: Math.max(...payoffPoints.map(p => p.payoff)),
      maxLoss: Math.min(...payoffPoints.map(p => p.payoff)),
      currentPrice
    }
  }

  const selectStrategy = (strategy) => {
    setSelectedStrategy(strategy)
    setShowPayoff(true)
    // Initialize default strikes
    const defaultStrikes = {}
    strategy.legs.forEach((leg, index) => {
      defaultStrikes[`strike_${index}`] = availableStrikes[Math.floor(availableStrikes.length / 2)]
    })
    setSelectedStrikes(defaultStrikes)
  }

  const addCustomLeg = () => {
    setCustomLegs([...customLegs, {
      action: 'buy',
      type: 'call',
      contracts: 1,
      strike: availableStrikes[Math.floor(availableStrikes.length / 2)]
    }])
  }

  const updateCustomLeg = (index, field, value) => {
    const updated = [...customLegs]
    updated[index] = { ...updated[index], [field]: value }
    setCustomLegs(updated)
  }

  const removeCustomLeg = (index) => {
    setCustomLegs(customLegs.filter((_, i) => i !== index))
  }

  // Calculate payoff for current strategy
  useEffect(() => {
    if (selectedStrategy && Object.keys(selectedStrikes).length > 0) {
      const payoff = calculatePayoff(selectedStrategy, selectedStrikes)
      setPayoffData(payoff)
    }
  }, [selectedStrategy, selectedStrikes, optionsData, selectedExpiration])

  if (!optionsData || !selectedExpiration) {
    return (
      <div className="optionsStrategies">
        <div className="noData">
          <h3>⚡ Options Strategies</h3>
          <p>Select an expiration date to build strategies</p>
        </div>
      </div>
    )
  }

  return (
    <div className="optionsStrategies">
      <div className="strategiesHeader">
        <h2>⚡ Options Strategies - {symbol}</h2>
        <div className="strategiesInfo">
          <span>Expiration: {selectedExpiration}</span>
          <span>Current Price: ${optionsData.currentPrice?.toFixed(2)}</span>
        </div>
      </div>

      <div className="strategiesContent">
        {/* Left Panel - Strategy Selection */}
        <div className="strategiesPanel">
          <div className="panelHeader">
            <h3>📋 Predefined Strategies</h3>
            <p>Select a strategy to analyze payoff</p>
          </div>

          <div className="strategiesList">
            {PREDEFINED_STRATEGIES.map(strategy => (
              <div 
                key={strategy.id}
                className={`strategyCard ${selectedStrategy?.id === strategy.id ? 'selected' : ''}`}
                onClick={() => selectStrategy(strategy)}
              >
                <div className="strategyHeader">
                  <h4>{strategy.name}</h4>
                  <span className={`complexity ${strategy.complexity.toLowerCase()}`}>
                    {strategy.complexity}
                  </span>
                </div>
                <p className="strategyDescription">{strategy.description}</p>
                <div className="strategyMetrics">
                  <div className="metric">
                    <span className="label">Max Risk:</span>
                    <span className="value risk">{strategy.maxRisk}</span>
                  </div>
                  <div className="metric">
                    <span className="label">Max Reward:</span>
                    <span className="value reward">{strategy.maxReward}</span>
                  </div>
                </div>
                <div className="strategyLegs">
                  {strategy.legs.map((leg, index) => (
                    <span key={index} className={`leg ${leg.action}`}>
                      {leg.action.toUpperCase()} {leg.contracts} {leg.type.toUpperCase()}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Custom Strategy Builder */}
          <div className="customStrategy">
            <div className="panelHeader">
              <h3>🔧 Custom Strategy Builder</h3>
              <button onClick={addCustomLeg} className="addLegBtn">+ Add Leg</button>
            </div>

            {customLegs.map((leg, index) => (
              <div key={index} className="customLeg">
                <select 
                  value={leg.action}
                  onChange={(e) => updateCustomLeg(index, 'action', e.target.value)}
                >
                  <option value="buy">Buy</option>
                  <option value="sell">Sell</option>
                </select>
                
                <select 
                  value={leg.type}
                  onChange={(e) => updateCustomLeg(index, 'type', e.target.value)}
                >
                  <option value="call">Call</option>
                  <option value="put">Put</option>
                </select>
                
                <input 
                  type="number"
                  value={leg.contracts}
                  onChange={(e) => updateCustomLeg(index, 'contracts', parseInt(e.target.value))}
                  min="1"
                  max="10"
                />
                
                <select 
                  value={leg.strike}
                  onChange={(e) => updateCustomLeg(index, 'strike', parseFloat(e.target.value))}
                >
                  {availableStrikes.map(strike => (
                    <option key={strike} value={strike}>${strike}</option>
                  ))}
                </select>
                
                <button onClick={() => removeCustomLeg(index)} className="removeLegBtn">×</button>
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel - Strategy Analysis */}
        {selectedStrategy && (
          <div className="analysisPanel">
            <div className="panelHeader">
              <h3>📊 Strategy Analysis: {selectedStrategy.name}</h3>
            </div>

            {/* Strike Selection */}
            <div className="strikeSelection">
              <h4>Select Strikes</h4>
              <div className="strikeInputs">
                {selectedStrategy.legs.map((leg, index) => (
                  <div key={index} className="strikeInput">
                    <label>
                      {leg.action.toUpperCase()} {leg.type.toUpperCase()} Strike:
                    </label>
                    <select 
                      value={selectedStrikes[`strike_${index}`] || ''}
                      onChange={(e) => setSelectedStrikes({
                        ...selectedStrikes,
                        [`strike_${index}`]: parseFloat(e.target.value)
                      })}
                    >
                      {availableStrikes.map(strike => (
                        <option key={strike} value={strike}>${strike}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Strategy Metrics */}
            {payoffData && (
              <div className="strategyMetrics">
                <h4>Strategy Metrics</h4>
                <div className="metricsGrid">
                  <div className="metricItem">
                    <span className="label">Initial Cost:</span>
                    <span className={`value ${payoffData.initialCost > 0 ? 'cost' : 'credit'}`}>
                      ${Math.abs(payoffData.initialCost).toFixed(2)} {payoffData.initialCost > 0 ? 'Debit' : 'Credit'}
                    </span>
                  </div>
                  <div className="metricItem">
                    <span className="label">Breakeven:</span>
                    <span className="value">${payoffData.breakeven?.toFixed(2)}</span>
                  </div>
                  <div className="metricItem">
                    <span className="label">Max Profit:</span>
                    <span className="value profit">${payoffData.maxProfit.toFixed(2)}</span>
                  </div>
                  <div className="metricItem">
                    <span className="label">Max Loss:</span>
                    <span className="value loss">${Math.abs(payoffData.maxLoss).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Payoff Diagram */}
            {payoffData && (
              <div className="payoffDiagram">
                <h4>Payoff Diagram</h4>
                <div className="chartContainer">
                  <svg width="100%" height="300" viewBox="0 0 400 300">
                    {/* Grid lines */}
                    <defs>
                      <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1"/>
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />
                    
                    {/* Zero line */}
                    <line x1="0" y1="150" x2="400" y2="150" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
                    
                    {/* Current price line */}
                    <line 
                      x1="200" 
                      y1="0" 
                      x2="200" 
                      y2="300" 
                      stroke="#FFD700" 
                      strokeWidth="2" 
                      strokeDasharray="5,5"
                    />
                    
                    {/* Payoff curve */}
                    <path
                      d={`M ${payoffData.points.map((point, index) => 
                        `${(index / payoffData.points.length) * 400},${150 - (point.payoff / Math.max(Math.abs(payoffData.maxProfit), Math.abs(payoffData.maxLoss))) * 100}`
                      ).join(' L ')}`}
                      fill="none"
                      stroke="#8B5CF6"
                      strokeWidth="3"
                    />
                    
                    {/* Profit area */}
                    <path
                      d={`M ${payoffData.points.map((point, index) => 
                        `${(index / payoffData.points.length) * 400},${point.payoff > 0 ? 150 - (point.payoff / Math.max(Math.abs(payoffData.maxProfit), Math.abs(payoffData.maxLoss))) * 100 : 150}`
                      ).join(' L ')} L 400,150 L 0,150 Z`}
                      fill="rgba(0, 200, 5, 0.1)"
                    />
                  </svg>
                  
                  <div className="chartLabels">
                    <span className="leftLabel">Lower Prices</span>
                    <span className="centerLabel">Current: ${payoffData.currentPrice.toFixed(2)}</span>
                    <span className="rightLabel">Higher Prices</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
} 