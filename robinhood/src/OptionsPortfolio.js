import React, { useState, useEffect, useMemo } from 'react'
import { getCurrentUser, getOptionsPositions, getOptionsHistory, calculatePortfolioGreeks } from './userData'
import './OptionsPortfolio.css'

export default function OptionsPortfolio() {
  const [positions, setPositions] = useState([])
  const [history, setHistory] = useState([])
  const [portfolioGreeks, setPortfolioGreeks] = useState(null)
  const [selectedView, setSelectedView] = useState('positions') // positions, history, analysis
  const [loading, setLoading] = useState(true)
  const [totalValue, setTotalValue] = useState(0)
  const [totalPnL, setTotalPnL] = useState(0)

  // Load portfolio data
  useEffect(() => {
    async function loadPortfolioData() {
      setLoading(true)
      try {
        const user = getCurrentUser()
        if (user) {
          console.log('🔄 Loading portfolio data for user:', user.uid)
          
          const [positionsData, historyData] = await Promise.all([
            getOptionsPositions(user.uid),
            getOptionsHistory(user.uid)
          ])
          
          console.log('📊 Loaded positions:', positionsData)
          console.log('📈 Loaded history:', historyData)
          
          setPositions(positionsData || [])
          setHistory(historyData || [])
          
          // Calculate Greeks after getting positions
          const greeksData = calculatePortfolioGreeks(positionsData || [])
          console.log('🔬 Calculated Greeks:', greeksData)
          setPortfolioGreeks(greeksData)
          
          // Calculate total values
          const totalPortfolioValue = positionsData?.reduce((sum, pos) => sum + (pos.currentValue || 0), 0) || 0
          const totalPortfolioPnL = positionsData?.reduce((sum, pos) => sum + (pos.unrealizedPnL || 0), 0) || 0
          
          console.log('💰 Total value:', totalPortfolioValue, 'Total P&L:', totalPortfolioPnL)
          
          setTotalValue(totalPortfolioValue)
          setTotalPnL(totalPortfolioPnL)
        } else {
          console.log('❌ No user found')
        }
      } catch (error) {
        console.error('❌ Error loading portfolio data:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadPortfolioData()
  }, [])

  // Group positions by symbol
  const positionsBySymbol = useMemo(() => {
    const grouped = {}
    positions.forEach(position => {
      if (!grouped[position.symbol]) {
        grouped[position.symbol] = []
      }
      grouped[position.symbol].push(position)
    })
    return grouped
  }, [positions])

  // Calculate portfolio metrics
  const portfolioMetrics = useMemo(() => {
    if (!positions.length) return null

    const totalInvested = positions.reduce((sum, pos) => sum + Math.abs(pos.costBasis || 0), 0)
    const totalCurrentValue = positions.reduce((sum, pos) => sum + (pos.currentValue || 0), 0)
    const totalPnL = positions.reduce((sum, pos) => sum + (pos.unrealizedPnL || 0), 0)
    const totalRealizedPnL = history.reduce((sum, trade) => sum + (trade.realizedPnL || 0), 0)
    
    const winningPositions = positions.filter(pos => (pos.unrealizedPnL || 0) > 0).length
    const losingPositions = positions.filter(pos => (pos.unrealizedPnL || 0) < 0).length
    const winRate = positions.length > 0 ? (winningPositions / positions.length) * 100 : 0

    return {
      totalInvested,
      totalCurrentValue,
      totalPnL,
      totalRealizedPnL,
      winningPositions,
      losingPositions,
      winRate,
      positionsCount: positions.length
    }
  }, [positions, history])

  const formatCurrency = (value) => {
    if (value === undefined || value === null) return '$0.00'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value)
  }

  const formatPercent = (value) => {
    if (value === undefined || value === null) return '0.00%'
    return `${(value * 100).toFixed(2)}%`
  }

  const formatGreek = (value, decimals = 4) => {
    if (value === undefined || value === null) return '0'
    return value.toFixed(decimals)
  }

  if (loading) {
    return (
      <div className="optionsPortfolio">
        <div className="loadingState">
          <h3>📊 Loading Portfolio...</h3>
          <p>Fetching your options positions and analytics</p>
        </div>
      </div>
    )
  }

  return (
    <div className="optionsPortfolio">
      <div className="portfolioHeader">
        <h2>📊 Options Portfolio</h2>
        <div className="portfolioSummary">
          <div className="summaryCard">
            <span className="label">Total Value</span>
            <span className="value">{formatCurrency(totalValue)}</span>
          </div>
          <div className="summaryCard">
            <span className="label">Unrealized P&L</span>
            <span className={`value ${totalPnL >= 0 ? 'positive' : 'negative'}`}>
              {formatCurrency(totalPnL)}
            </span>
          </div>
          <div className="summaryCard">
            <span className="label">Positions</span>
            <span className="value">{positions.length}</span>
          </div>
        </div>
      </div>

      {/* View Selector */}
      <div className="viewSelector">
        <button 
          className={`viewBtn ${selectedView === 'positions' ? 'active' : ''}`}
          onClick={() => setSelectedView('positions')}
        >
          📋 Current Positions
        </button>
        <button 
          className={`viewBtn ${selectedView === 'history' ? 'active' : ''}`}
          onClick={() => setSelectedView('history')}
        >
          📈 Trade History
        </button>
        <button 
          className={`viewBtn ${selectedView === 'analysis' ? 'active' : ''}`}
          onClick={() => setSelectedView('analysis')}
        >
          🔬 Portfolio Analysis
        </button>
      </div>

      {/* Portfolio Metrics */}
      {portfolioMetrics && (
        <div className="portfolioMetrics">
          <div className="metricCard">
            <div className="metricLabel">Total Invested</div>
            <div className="metricValue">{formatCurrency(portfolioMetrics.totalInvested)}</div>
          </div>
          <div className="metricCard">
            <div className="metricLabel">Current Value</div>
            <div className="metricValue">{formatCurrency(portfolioMetrics.totalCurrentValue)}</div>
          </div>
          <div className="metricCard">
            <div className="metricLabel">Unrealized P&L</div>
            <div className={`metricValue ${portfolioMetrics.totalPnL >= 0 ? 'positive' : 'negative'}`}>
              {formatCurrency(portfolioMetrics.totalPnL)}
            </div>
          </div>
          <div className="metricCard">
            <div className="metricLabel">Realized P&L</div>
            <div className={`metricValue ${portfolioMetrics.totalRealizedPnL >= 0 ? 'positive' : 'negative'}`}>
              {formatCurrency(portfolioMetrics.totalRealizedPnL)}
            </div>
          </div>
          <div className="metricCard">
            <div className="metricLabel">Win Rate</div>
            <div className="metricValue">{portfolioMetrics.winRate.toFixed(1)}%</div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="portfolioContent">
        {selectedView === 'positions' && (
          <div className="positionsView">
            {positions.length === 0 ? (
              <div className="noPositions">
                <h3>💼 No Open Positions</h3>
                <p>Start trading options to build your portfolio</p>
              </div>
            ) : (
              <div className="positionsContainer">
                {Object.entries(positionsBySymbol).map(([symbol, symbolPositions]) => (
                  <div key={symbol} className="symbolGroup">
                    <h3 className="symbolHeader">{symbol}</h3>
                    <div className="positionsTable">
                      <div className="tableHeader">
                        <span>Option</span>
                        <span>Quantity</span>
                        <span>Cost Basis</span>
                        <span>Current Value</span>
                        <span>P&L</span>
                        <span>Delta</span>
                        <span>Theta</span>
                        <span>IV</span>
                      </div>
                      {symbolPositions.map((position, index) => (
                        <div key={index} className="positionRow">
                          <div className="optionInfo">
                            <span className={`optionType ${position.type}`}>
                              {position.type?.toUpperCase()}
                            </span>
                            <span className="strike">${position.strike}</span>
                            <span className="expiration">{position.expiration}</span>
                          </div>
                          <span className={`quantity ${position.side}`}>
                            {position.side === 'short' ? '-' : ''}{position.quantity}
                          </span>
                          <span className="costBasis">{formatCurrency(position.costBasis)}</span>
                          <span className="currentValue">{formatCurrency(position.currentValue)}</span>
                          <span className={`pnl ${(position.unrealizedPnL || 0) >= 0 ? 'positive' : 'negative'}`}>
                            {formatCurrency(position.unrealizedPnL)}
                          </span>
                          <span className="delta">{formatGreek(position.delta, 3)}</span>
                          <span className="theta">{formatGreek(position.theta, 3)}</span>
                          <span className="iv">{formatPercent(position.impliedVolatility)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {selectedView === 'history' && (
          <div className="historyView">
            {history.length === 0 ? (
              <div className="noHistory">
                <h3>📈 No Trade History</h3>
                <p>Your completed options trades will appear here</p>
              </div>
            ) : (
              <div className="historyTable">
                <div className="tableHeader">
                  <span>Date</span>
                  <span>Symbol</span>
                  <span>Option</span>
                  <span>Action</span>
                  <span>Quantity</span>
                  <span>Price</span>
                  <span>Realized P&L</span>
                </div>
                {history.map((trade, index) => (
                  <div key={index} className="historyRow">
                    <span className="date">{new Date(trade.timestamp).toLocaleDateString()}</span>
                    <span className="symbol">{trade.symbol}</span>
                    <div className="optionInfo">
                      <span className={`optionType ${trade.type}`}>
                        {trade.type?.toUpperCase()}
                      </span>
                      <span className="strike">${trade.strike}</span>
                      <span className="expiration">{trade.expiration}</span>
                    </div>
                    <span className={`action ${trade.action}`}>{trade.action?.toUpperCase()}</span>
                    <span className="quantity">{trade.quantity}</span>
                    <span className="price">{formatCurrency(trade.price)}</span>
                    <span className={`realizedPnL ${(trade.realizedPnL || 0) >= 0 ? 'positive' : 'negative'}`}>
                      {formatCurrency(trade.realizedPnL)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {selectedView === 'analysis' && (
          <div className="analysisView">
            <div className="analysisGrid">
              {/* Portfolio Greeks */}
              <div className="analysisCard">
                <h3>🔬 Portfolio Greeks</h3>
                {portfolioGreeks ? (
                  <div className="greeksGrid">
                    <div className="greekItem">
                      <span className="greekLabel">Net Delta:</span>
                      <span className="greekValue">{formatGreek(portfolioGreeks.netDelta, 2)}</span>
                    </div>
                    <div className="greekItem">
                      <span className="greekLabel">Net Gamma:</span>
                      <span className="greekValue">{formatGreek(portfolioGreeks.netGamma, 4)}</span>
                    </div>
                    <div className="greekItem">
                      <span className="greekLabel">Net Theta:</span>
                      <span className="greekValue">{formatGreek(portfolioGreeks.netTheta, 2)}</span>
                    </div>
                    <div className="greekItem">
                      <span className="greekLabel">Net Vega:</span>
                      <span className="greekValue">{formatGreek(portfolioGreeks.netVega, 2)}</span>
                    </div>
                  </div>
                ) : (
                  <p>No Greeks data available</p>
                )}
              </div>

              {/* Risk Metrics */}
              <div className="analysisCard">
                <h3>⚖️ Risk Metrics</h3>
                {portfolioMetrics && (
                  <div className="riskMetrics">
                    <div className="riskItem">
                      <span className="riskLabel">Portfolio Beta:</span>
                      <span className="riskValue">0.85</span>
                    </div>
                    <div className="riskItem">
                      <span className="riskLabel">Max Risk:</span>
                      <span className="riskValue">{formatCurrency(portfolioMetrics.totalInvested)}</span>
                    </div>
                    <div className="riskItem">
                      <span className="riskLabel">Win/Loss Ratio:</span>
                      <span className="riskValue">
                        {portfolioMetrics.winningPositions}/{portfolioMetrics.losingPositions}
                      </span>
                    </div>
                    <div className="riskItem">
                      <span className="riskLabel">Avg. Days to Expiry:</span>
                      <span className="riskValue">
                        {Math.round(
                          positions.reduce((sum, pos) => {
                            const daysToExpiry = Math.max(0, (new Date(pos.expiration) - new Date()) / (1000 * 60 * 60 * 24))
                            return sum + daysToExpiry
                          }, 0) / positions.length || 0
                        )} days
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Performance Chart */}
              <div className="analysisCard fullWidth">
                <h3>📊 Performance Overview</h3>
                <div className="performanceChart">
                  {/* Simple performance visualization */}
                  <div className="chartContainer">
                    <div className="performanceBar">
                      <div className="performanceMetric">
                        <span>This Week</span>
                        <span className="positive">+2.5%</span>
                      </div>
                      <div className="performanceMetric">
                        <span>This Month</span>
                        <span className="positive">+8.2%</span>
                      </div>
                      <div className="performanceMetric">
                        <span>3 Months</span>
                        <span className="negative">-1.8%</span>
                      </div>
                      <div className="performanceMetric">
                        <span>Year to Date</span>
                        <span className="positive">+15.6%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 