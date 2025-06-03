import React, { useState, useMemo } from 'react'
import './OptionsChain.css'

export default function OptionsChain({ 
  optionsData, 
  selectedExpiration, 
  onExpirationChange, 
  onOptionSelect, 
  selectedOption 
}) {
  const [filterType, setFilterType] = useState('all') // all, itm, otm
  const [sortBy, setSortBy] = useState('strike') // strike, volume, oi

  // Get chain data safely
  const chainData = optionsData?.chains?.[selectedExpiration]

  // Filter and sort options (moved before early returns to fix React Hooks rules)
  const { filteredCalls, filteredPuts } = useMemo(() => {
    if (!chainData) {
      return { filteredCalls: [], filteredPuts: [] }
    }

    let calls = [...chainData.calls]
    let puts = [...chainData.puts]
    
    // Apply filters
    if (filterType === 'itm') {
      calls = calls.filter(option => option.inTheMoney)
      puts = puts.filter(option => option.inTheMoney)
    } else if (filterType === 'otm') {
      calls = calls.filter(option => !option.inTheMoney)
      puts = puts.filter(option => !option.inTheMoney)
    }
    
    // Apply sorting
    const sortFn = (a, b) => {
      switch (sortBy) {
        case 'volume':
          return (b.volume || 0) - (a.volume || 0)
        case 'oi':
          return (b.openInterest || 0) - (a.openInterest || 0)
        case 'strike':
        default:
          return a.strike - b.strike
      }
    }
    
    calls.sort(sortFn)
    puts.sort(sortFn)
    
    return { filteredCalls: calls, filteredPuts: puts }
  }, [chainData, filterType, sortBy])

  // Get unique strikes for alignment (moved before early returns)
  const allStrikes = useMemo(() => {
    if (!filteredCalls.length && !filteredPuts.length) {
      return []
    }
    
    const strikes = new Set([
      ...filteredCalls.map(c => c.strike),
      ...filteredPuts.map(p => p.strike)
    ])
    return Array.from(strikes).sort((a, b) => a - b)
  }, [filteredCalls, filteredPuts])

  // Early returns after hooks
  if (!optionsData || !selectedExpiration) {
    return (
      <div className="optionsChain">
        <div className="noData">
          <p>No options data available</p>
        </div>
      </div>
    )
  }
  
  if (!chainData) {
    return (
      <div className="optionsChain">
        <div className="noData">
          <p>No data for selected expiration</p>
        </div>
      </div>
    )
  }

  const formatVolume = (volume) => {
    if (!volume || volume === 0) return '-'
    if (volume >= 1000) return `${(volume / 1000).toFixed(1)}K`
    return volume.toString()
  }

  const formatOpenInterest = (oi) => {
    if (!oi || oi === 0) return '-'
    if (oi >= 1000) return `${(oi / 1000).toFixed(1)}K`
    return oi.toString()
  }

  const getOptionKey = (option, type) => {
    return `${type}_${option.strike}_${selectedExpiration}`
  }

  const isSelected = (option, type) => {
    return selectedOption && 
           selectedOption.strike === option.strike && 
           selectedOption.expiration === selectedExpiration &&
           selectedOption.type === type
  }

  return (
    <div className="optionsChain">
      {/* Header Controls */}
      <div className="chainHeader">
        <div className="expirationSelector">
          <label>Expiration:</label>
          <select 
            value={selectedExpiration} 
            onChange={(e) => onExpirationChange(e.target.value)}
          >
            {optionsData.expirationDates.map(date => (
              <option key={date} value={date}>{date}</option>
            ))}
          </select>
        </div>

        <div className="chainFilters">
          <div className="filterGroup">
            <label>Filter:</label>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="all">All Options</option>
              <option value="itm">In-The-Money</option>
              <option value="otm">Out-of-The-Money</option>
            </select>
          </div>

          <div className="filterGroup">
            <label>Sort:</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="strike">Strike Price</option>
              <option value="volume">Volume</option>
              <option value="oi">Open Interest</option>
            </select>
          </div>
        </div>

        <div className="chainInfo">
          <span className="timeToExp">
            Time to Expiration: {Math.max(0, Math.round(chainData.timeToExpiration * 365))} days
          </span>
        </div>
      </div>

      {/* Options Chain Table */}
      <div className="chainTable">
        {/* Table Headers */}
        <div className="chainHeaders">
          <div className="callsHeader">
            <h3>📈 CALLS</h3>
            <div className="headerRow">
              <span className="col-bid">Bid</span>
              <span className="col-ask">Ask</span>
              <span className="col-last">Last</span>
              <span className="col-vol">Vol</span>
              <span className="col-oi">OI</span>
              <span className="col-iv">IV</span>
              <span className="col-delta">Δ</span>
            </div>
          </div>
          
          <div className="strikeHeader">
            <h3>Strike</h3>
          </div>
          
          <div className="putsHeader">
            <h3>📉 PUTS</h3>
            <div className="headerRow">
              <span className="col-delta">Δ</span>
              <span className="col-iv">IV</span>
              <span className="col-oi">OI</span>
              <span className="col-vol">Vol</span>
              <span className="col-last">Last</span>
              <span className="col-ask">Ask</span>
              <span className="col-bid">Bid</span>
            </div>
          </div>
        </div>

        {/* Options Rows */}
        <div className="chainRows">
          {allStrikes.map(strike => {
            const call = filteredCalls.find(c => c.strike === strike)
            const put = filteredPuts.find(p => p.strike === strike)
            
            return (
              <div key={strike} className="chainRow">
                {/* Calls Side */}
                <div 
                  className={`callSide ${call ? 'hasData' : 'noData'} ${call && isSelected(call, 'call') ? 'selected' : ''}`}
                  onClick={() => call && onOptionSelect({...call, type: 'call'}, selectedExpiration)}
                >
                  {call ? (
                    <>
                      <span className="col-bid">{call.bid?.toFixed(2) || '-'}</span>
                      <span className="col-ask">{call.ask?.toFixed(2) || '-'}</span>
                      <span className={`col-last ${call.inTheMoney ? 'itm' : 'otm'}`}>
                        {call.lastPrice?.toFixed(2) || '-'}
                      </span>
                      <span className="col-vol">{formatVolume(call.volume)}</span>
                      <span className="col-oi">{formatOpenInterest(call.openInterest)}</span>
                      <span className="col-iv">{(call.impliedVolatility * 100).toFixed(1)}%</span>
                      <span className="col-delta">{call.delta?.toFixed(3) || '-'}</span>
                    </>
                  ) : (
                    <div className="emptyOption">-</div>
                  )}
                </div>

                {/* Strike Price */}
                <div className={`strikePrice ${optionsData.currentPrice === strike ? 'atm' : optionsData.currentPrice > strike ? 'belowPrice' : 'abovePrice'}`}>
                  {strike.toFixed(0)}
                </div>

                {/* Puts Side */}
                <div 
                  className={`putSide ${put ? 'hasData' : 'noData'} ${put && isSelected(put, 'put') ? 'selected' : ''}`}
                  onClick={() => put && onOptionSelect({...put, type: 'put'}, selectedExpiration)}
                >
                  {put ? (
                    <>
                      <span className="col-delta">{put.delta?.toFixed(3) || '-'}</span>
                      <span className="col-iv">{(put.impliedVolatility * 100).toFixed(1)}%</span>
                      <span className="col-oi">{formatOpenInterest(put.openInterest)}</span>
                      <span className="col-vol">{formatVolume(put.volume)}</span>
                      <span className={`col-last ${put.inTheMoney ? 'itm' : 'otm'}`}>
                        {put.lastPrice?.toFixed(2) || '-'}
                      </span>
                      <span className="col-ask">{put.ask?.toFixed(2) || '-'}</span>
                      <span className="col-bid">{put.bid?.toFixed(2) || '-'}</span>
                    </>
                  ) : (
                    <div className="emptyOption">-</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Chain Statistics */}
      <div className="chainStats">
        <div className="statGroup">
          <label>Calls:</label>
          <span>{filteredCalls.length} contracts</span>
        </div>
        <div className="statGroup">
          <label>Puts:</label>
          <span>{filteredPuts.length} contracts</span>
        </div>
        <div className="statGroup">
          <label>Total Volume:</label>
          <span>{formatVolume([...filteredCalls, ...filteredPuts].reduce((sum, opt) => sum + (opt.volume || 0), 0))}</span>
        </div>
        <div className="statGroup">
          <label>Total OI:</label>
          <span>{formatOpenInterest([...filteredCalls, ...filteredPuts].reduce((sum, opt) => sum + (opt.openInterest || 0), 0))}</span>
        </div>
      </div>

      {/* Legend */}
      <div className="chainLegend">
        <div className="legendItem">
          <span className="legend-color itm"></span>
          <span>In-the-Money</span>
        </div>
        <div className="legendItem">
          <span className="legend-color otm"></span>
          <span>Out-of-the-Money</span>
        </div>
        <div className="legendItem">
          <span className="legend-color atm"></span>
          <span>At-the-Money</span>
        </div>
      </div>
    </div>
  )
} 