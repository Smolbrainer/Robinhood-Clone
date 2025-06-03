import React, { useState, useEffect } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import './OptionsPage.css'
import OptionsChain from './OptionsChain'
import OptionsTrading from './OptionsTrading'
import OptionsAnalytics from './OptionsAnalytics'
import OptionsStrategies from './OptionsStrategies'
import OptionsPortfolio from './OptionsPortfolio'
import { useAuth } from './AuthContext'

const PREDICTION_API_URL = 'http://localhost:5000'

export default function OptionsPage() {
  const { symbol: paramSymbol } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  
  const [symbol, setSymbol] = useState(paramSymbol?.toUpperCase() || 'AAPL')
  const [optionsData, setOptionsData] = useState(null)
  const [selectedExpiration, setSelectedExpiration] = useState('')
  const [selectedOption, setSelectedOption] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('chain') // chain, analytics, strategies, portfolio
  
  // Auto-refresh controls
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Fetch options data
  useEffect(() => {
    async function fetchOptionsData() {
      if (!symbol) return
      
      try {
        if (autoRefreshEnabled) setIsRefreshing(true)
        setLoading(true)
        setError(null)
        
        console.log(`Fetching options data for ${symbol}...`) // Debug log
        
        const response = await fetch(`${PREDICTION_API_URL}/options-chain/${symbol}`)
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const result = await response.json()
        
        console.log('Options API response:', result) // Debug log
        
        // Check if the response has the expected structure
        if (result && result.data && result.data.chains) {
          setOptionsData(result.data)
          
          // Set default expiration if not already set
          if (!selectedExpiration && result.data.expirationDates && result.data.expirationDates.length > 0) {
            setSelectedExpiration(result.data.expirationDates[0])
          }
          
          console.log('Options data set successfully:', result.data) // Debug log
        } else {
          console.error('Invalid response structure:', result) // Debug log
          setError(result?.error || 'Invalid response format from options service')
        }
        
        setLastRefresh(new Date())
      } catch (err) {
        console.error('Error fetching options data:', err)
        setError(`Unable to connect to options service: ${err.message}`)
      } finally {
        setLoading(false)
        if (autoRefreshEnabled) {
          setTimeout(() => setIsRefreshing(false), 500)
        }
      }
    }

    fetchOptionsData()
    
    // Auto-refresh every 30 seconds if enabled
    let interval
    if (autoRefreshEnabled) {
      interval = setInterval(fetchOptionsData, 30000)
    }
    
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [symbol, autoRefreshEnabled])

  // Handle symbol change
  const handleSymbolChange = (newSymbol) => {
    const upperSymbol = newSymbol.toUpperCase()
    setSymbol(upperSymbol)
    setSelectedOption(null)
    setSelectedExpiration('')
    navigate(`/options/${upperSymbol}`, { replace: true })
  }

  // Handle option selection
  const handleOptionSelect = (option, expiration) => {
    setSelectedOption({ ...option, expiration })
  }

  if (!currentUser) {
    return (
      <div className="optionsPage">
        <div className="authRequired">
          <h2>🔐 Authentication Required</h2>
          <p>Please sign in to access options trading features.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="optionsPage">
      {/* Header */}
      <div className="optionsHeader">
        <div className="symbolSelector">
          <input
            type="text"
            placeholder="Enter symbol (e.g., AAPL)"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSymbolChange(symbol)
              }
            }}
            className="symbolInput"
          />
          <button 
            onClick={() => handleSymbolChange(symbol)}
            className="searchButton"
          >
            Search
          </button>
        </div>

        {optionsData && (
          <div className="stockInfo">
            <h2>{symbol}</h2>
            <div className="currentPrice">
              ${optionsData.currentPrice?.toFixed(2)}
            </div>
          </div>
        )}

        {/* Auto-refresh controls */}
        <div className="refreshControls">
          <button 
            onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
            className={`refreshToggle ${autoRefreshEnabled ? 'active' : ''}`}
          >
            {autoRefreshEnabled ? '🔄 Live' : '⏸️ Paused'}
          </button>
          
          {isRefreshing && (
            <div className="refreshIndicator">
              <div className="spinner"></div>
              Updating...
            </div>
          )}
          
          <span className="lastRefreshTime">
            Last: {lastRefresh.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
          </span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="optionsNavigation">
        <button 
          className={`navTab ${activeTab === 'chain' ? 'active' : ''}`}
          onClick={() => setActiveTab('chain')}
        >
          📊 Options Chain
        </button>
        <button 
          className={`navTab ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          📈 Analytics
        </button>
        <button 
          className={`navTab ${activeTab === 'strategies' ? 'active' : ''}`}
          onClick={() => setActiveTab('strategies')}
        >
          🎯 Strategies
        </button>
        <button 
          className={`navTab ${activeTab === 'portfolio' ? 'active' : ''}`}
          onClick={() => setActiveTab('portfolio')}
        >
          💼 Portfolio
        </button>
      </div>

      {/* Content Area */}
      <div className="optionsContent">
        {loading ? (
          <div className="loadingState">
            <div className="spinner large"></div>
            <p>Loading options data for {symbol}...</p>
          </div>
        ) : error ? (
          <div className="errorState">
            <h3>⚠️ Error Loading Options Data</h3>
            <p>{error}</p>
            <button onClick={() => window.location.reload()}>
              Try Again
            </button>
          </div>
        ) : !optionsData ? (
          <div className="noDataState">
            <h3>📊 No Options Data Available</h3>
            <p>Options data is not available for {symbol}. Please try a different symbol.</p>
          </div>
        ) : (
          <div className="contentTabs">
            {/* Options Chain Tab */}
            {activeTab === 'chain' && (
              <div className="chainTab">
                <div className="leftPanel">
                  <OptionsChain
                    optionsData={optionsData}
                    selectedExpiration={selectedExpiration}
                    onExpirationChange={setSelectedExpiration}
                    onOptionSelect={handleOptionSelect}
                    selectedOption={selectedOption}
                  />
                </div>
                <div className="rightPanel">
                  <OptionsTrading
                    selectedOption={selectedOption}
                    currentPrice={optionsData.currentPrice}
                    symbol={symbol}
                  />
                </div>
              </div>
            )}

            {/* Analytics Tab */}
            {activeTab === 'analytics' && (
              <OptionsAnalytics
                optionsData={optionsData}
                selectedExpiration={selectedExpiration}
                symbol={symbol}
              />
            )}

            {/* Strategies Tab */}
            {activeTab === 'strategies' && (
              <OptionsStrategies
                optionsData={optionsData}
                selectedExpiration={selectedExpiration}
                symbol={symbol}
              />
            )}

            {/* Portfolio Tab */}
            {activeTab === 'portfolio' && (
              <OptionsPortfolio
                symbol={symbol}
                currentPrice={optionsData?.currentPrice}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
} 