import React, { useState, useEffect, useMemo } from 'react'
import './OptionsAnalytics.css'

export default function OptionsAnalytics({ optionsData, selectedExpiration, symbol }) {
  const [analyticsData, setAnalyticsData] = useState(null)
  const [selectedMetric, setSelectedMetric] = useState('volatility') // volatility, greeks, volume

  // Process options data for analytics
  const analytics = useMemo(() => {
    if (!optionsData || !selectedExpiration || !optionsData.chains[selectedExpiration]) {
      return null
    }

    const chainData = optionsData.chains[selectedExpiration]
    const calls = chainData.calls || []
    const puts = chainData.puts || []
    const currentPrice = optionsData.currentPrice

    // Calculate volatility smile/skew
    const volatilityData = [...calls, ...puts]
      .filter(option => option.impliedVolatility > 0)
      .map(option => ({
        strike: option.strike,
        iv: option.impliedVolatility,
        moneyness: option.strike / currentPrice,
        type: calls.includes(option) ? 'call' : 'put',
        volume: option.volume || 0,
        openInterest: option.openInterest || 0
      }))
      .sort((a, b) => a.strike - b.strike)

    // Calculate put-call ratio
    const totalCallVolume = calls.reduce((sum, call) => sum + (call.volume || 0), 0)
    const totalPutVolume = puts.reduce((sum, put) => sum + (put.volume || 0), 0)
    const putCallRatio = totalCallVolume > 0 ? totalPutVolume / totalCallVolume : 0

    // Calculate max pain (strike with most open interest)
    const maxPainData = [...calls, ...puts].reduce((acc, option) => {
      const strike = option.strike
      if (!acc[strike]) acc[strike] = 0
      acc[strike] += option.openInterest || 0
      return acc
    }, {})
    
    const maxPainStrike = Object.entries(maxPainData)
      .reduce((max, [strike, oi]) => (oi > max.oi ? { strike: parseFloat(strike), oi } : max), { strike: 0, oi: 0 })

    // Calculate Greeks by strike
    const greeksData = [...calls, ...puts]
      .filter(option => option.delta !== undefined)
      .map(option => ({
        strike: option.strike,
        delta: option.delta || 0,
        gamma: option.gamma || 0,
        theta: option.theta || 0,
        vega: option.vega || 0,
        type: calls.includes(option) ? 'call' : 'put'
      }))
      .sort((a, b) => a.strike - b.strike)

    // Volume analysis
    const volumeData = [...calls, ...puts]
      .filter(option => (option.volume || 0) > 0)
      .map(option => ({
        strike: option.strike,
        volume: option.volume || 0,
        openInterest: option.openInterest || 0,
        type: calls.includes(option) ? 'call' : 'put'
      }))
      .sort((a, b) => b.volume - a.volume)

    return {
      volatilityData,
      putCallRatio,
      maxPainStrike,
      greeksData,
      volumeData,
      currentPrice,
      totalCallVolume,
      totalPutVolume,
      avgCallIV: calls.reduce((sum, call) => sum + (call.impliedVolatility || 0), 0) / calls.length,
      avgPutIV: puts.reduce((sum, put) => sum + (put.impliedVolatility || 0), 0) / puts.length
    }
  }, [optionsData, selectedExpiration])

  if (!optionsData || !selectedExpiration) {
    return (
      <div className="optionsAnalytics">
        <div className="noData">
          <h3>📈 Options Analytics</h3>
          <p>Select an expiration date to view analytics</p>
        </div>
      </div>
    )
  }

  if (!analytics) {
    return (
      <div className="optionsAnalytics">
        <div className="noData">
          <h3>📈 Options Analytics</h3>
          <p>No analytics data available</p>
        </div>
      </div>
    )
  }

  return (
    <div className="optionsAnalytics">
      <div className="analyticsHeader">
        <h2>📈 Options Analytics - {symbol}</h2>
        <div className="expirationInfo">
          <span>Expiration: {selectedExpiration}</span>
          <span>Current Price: ${analytics.currentPrice?.toFixed(2)}</span>
        </div>
      </div>

      {/* Metric Selector */}
      <div className="metricSelector">
        <button 
          className={`metricBtn ${selectedMetric === 'volatility' ? 'active' : ''}`}
          onClick={() => setSelectedMetric('volatility')}
        >
          📊 Volatility Analysis
        </button>
        <button 
          className={`metricBtn ${selectedMetric === 'greeks' ? 'active' : ''}`}
          onClick={() => setSelectedMetric('greeks')}
        >
          🔬 Greeks Analysis
        </button>
        <button 
          className={`metricBtn ${selectedMetric === 'volume' ? 'active' : ''}`}
          onClick={() => setSelectedMetric('volume')}
        >
          📈 Volume Analysis
        </button>
      </div>

      {/* Key Metrics Dashboard */}
      <div className="keyMetrics">
        <div className="metricCard">
          <div className="metricLabel">Put/Call Ratio</div>
          <div className="metricValue">{analytics.putCallRatio.toFixed(2)}</div>
          <div className="metricDescription">
            {analytics.putCallRatio > 1 ? 'Bearish Sentiment' : 'Bullish Sentiment'}
          </div>
        </div>
        
        <div className="metricCard">
          <div className="metricLabel">Max Pain</div>
          <div className="metricValue">${analytics.maxPainStrike.strike}</div>
          <div className="metricDescription">Highest OI Strike</div>
        </div>
        
        <div className="metricCard">
          <div className="metricLabel">Call Volume</div>
          <div className="metricValue">{analytics.totalCallVolume.toLocaleString()}</div>
          <div className="metricDescription">Total Call Volume</div>
        </div>
        
        <div className="metricCard">
          <div className="metricLabel">Put Volume</div>
          <div className="metricValue">{analytics.totalPutVolume.toLocaleString()}</div>
          <div className="metricDescription">Total Put Volume</div>
        </div>
      </div>

      {/* Main Analytics Content */}
      <div className="analyticsContent">
        {selectedMetric === 'volatility' && (
          <div className="volatilityAnalysis">
            <h3>🌊 Implied Volatility Analysis</h3>
            
            <div className="volatilityMetrics">
              <div className="volMetric">
                <span className="volLabel">Avg Call IV:</span>
                <span className="volValue">{(analytics.avgCallIV * 100).toFixed(1)}%</span>
              </div>
              <div className="volMetric">
                <span className="volLabel">Avg Put IV:</span>
                <span className="volValue">{(analytics.avgPutIV * 100).toFixed(1)}%</span>
              </div>
              <div className="volMetric">
                <span className="volLabel">IV Skew:</span>
                <span className="volValue">
                  {((analytics.avgPutIV - analytics.avgCallIV) * 100).toFixed(1)}%
                </span>
              </div>
            </div>

            <div className="volatilityChart">
              <h4>Volatility Smile/Skew</h4>
              <div className="chartContainer">
                {analytics.volatilityData.map((point, index) => (
                  <div key={index} className="volPoint" style={{
                    left: `${((point.moneyness - 0.8) / 0.4) * 100}%`,
                    bottom: `${(point.iv / Math.max(...analytics.volatilityData.map(p => p.iv))) * 80}%`
                  }}>
                    <div className={`point ${point.type}`} title={`Strike: $${point.strike}, IV: ${(point.iv * 100).toFixed(1)}%`}></div>
                  </div>
                ))}
                <div className="atmLine" style={{ left: '50%' }} title="At-The-Money"></div>
              </div>
              <div className="chartLabels">
                <span>OTM Puts</span>
                <span>ATM</span>
                <span>OTM Calls</span>
              </div>
            </div>
          </div>
        )}

        {selectedMetric === 'greeks' && (
          <div className="greeksAnalysis">
            <h3>🔬 Greeks Analysis</h3>
            
            <div className="greeksCharts">
              <div className="greekChart">
                <h4>Delta Profile</h4>
                <div className="chartBars">
                  {analytics.greeksData.slice(0, 15).map((point, index) => (
                    <div key={index} className="greekBar">
                      <div 
                        className={`bar delta ${point.type}`}
                        style={{ height: `${Math.abs(point.delta) * 100}%` }}
                        title={`Strike: $${point.strike}, Delta: ${point.delta.toFixed(3)}`}
                      ></div>
                      <span className="strikeLabel">${point.strike}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="greekChart">
                <h4>Gamma Profile</h4>
                <div className="chartBars">
                  {analytics.greeksData.slice(0, 15).map((point, index) => (
                    <div key={index} className="greekBar">
                      <div 
                        className={`bar gamma ${point.type}`}
                        style={{ height: `${(point.gamma / Math.max(...analytics.greeksData.map(p => p.gamma))) * 100}%` }}
                        title={`Strike: $${point.strike}, Gamma: ${point.gamma.toFixed(4)}`}
                      ></div>
                      <span className="strikeLabel">${point.strike}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="greeksSummary">
              <div className="summaryCard">
                <h5>Portfolio Greeks Impact</h5>
                <div className="greekItem">
                  <span>Net Delta:</span>
                  <span>{analytics.greeksData.reduce((sum, g) => sum + g.delta, 0).toFixed(2)}</span>
                </div>
                <div className="greekItem">
                  <span>Net Gamma:</span>
                  <span>{analytics.greeksData.reduce((sum, g) => sum + g.gamma, 0).toFixed(4)}</span>
                </div>
                <div className="greekItem">
                  <span>Net Theta:</span>
                  <span>{analytics.greeksData.reduce((sum, g) => sum + g.theta, 0).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedMetric === 'volume' && (
          <div className="volumeAnalysis">
            <h3>📈 Volume & Open Interest Analysis</h3>
            
            <div className="volumeCharts">
              <div className="volumeChart">
                <h4>Top Volume Strikes</h4>
                <div className="volumeList">
                  {analytics.volumeData.slice(0, 10).map((item, index) => (
                    <div key={index} className="volumeItem">
                      <div className="volumeStrike">
                        <span className={`strikeType ${item.type}`}>${item.strike}</span>
                        <span className="typeLabel">{item.type.toUpperCase()}</span>
                      </div>
                      <div className="volumeBar">
                        <div 
                          className={`volumeFill ${item.type}`}
                          style={{ width: `${(item.volume / analytics.volumeData[0].volume) * 100}%` }}
                        ></div>
                        <span className="volumeText">{item.volume.toLocaleString()}</span>
                      </div>
                      <div className="oiText">OI: {item.openInterest.toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="volumeMetrics">
                <h4>Volume Insights</h4>
                <div className="insight">
                  <span className="insightLabel">Most Active Strike:</span>
                  <span className="insightValue">
                    ${analytics.volumeData[0]?.strike} ({analytics.volumeData[0]?.type})
                  </span>
                </div>
                <div className="insight">
                  <span className="insightLabel">Total Volume:</span>
                  <span className="insightValue">
                    {(analytics.totalCallVolume + analytics.totalPutVolume).toLocaleString()}
                  </span>
                </div>
                <div className="insight">
                  <span className="insightLabel">Volume Distribution:</span>
                  <span className="insightValue">
                    {((analytics.totalCallVolume / (analytics.totalCallVolume + analytics.totalPutVolume)) * 100).toFixed(1)}% Calls
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 