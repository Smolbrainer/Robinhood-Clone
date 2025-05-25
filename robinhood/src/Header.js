// Header.js
import React, { useState, useEffect, useRef } from 'react'
import { FaSearch } from 'react-icons/fa'
import { useNavigate } from 'react-router-dom'
import logo from './robinhood.svg'
import './Header.css'
import { Link } from 'react-router-dom'

const API_KEY = process.env.REACT_APP_FINNHUB_API_KEY

export default function Header() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [showDropdown, setShowDropdown] = useState(false)
  const containerRef = useRef()
  const navigate = useNavigate()

  useEffect(() => {
    if (!query) return setResults([])
    const ctrl = new AbortController()
    fetch(
      `https://finnhub.io/api/v1/search?q=${encodeURIComponent(query)}&token=${API_KEY}`,
      { signal: ctrl.signal }
    )
      .then(res => res.json())
      .then(data => setResults(data.result || []))
      .catch(err => { if (err.name !== 'AbortError') console.error(err) })
    return () => ctrl.abort()
  }, [query])

  // close on outside click
  useEffect(() => {
    const handle = e => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const onSelect = symbol => {
    setShowDropdown(false)
    setQuery('')
    navigate(`/stock/${symbol}`)
  }

  return (
    <div className="header__wrapper">
      <div className="header__logo">
          <Link to="/">
            <img src={logo} width={25} alt="robinhood logo" />
          </Link>
      </div>

      <div
        className="header__search"
        ref={containerRef}
        onFocus={() => setShowDropdown(true)}
      >
        <div className="header__searchContainer">
          <FaSearch className="searchIcon" />
          <input
            placeholder="Search for stocks"
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        {showDropdown && results.length > 0 && (
          <ul className="searchDropdown">
            {results.slice(0, 10).map(item => (
              <li
                key={item.symbol}
                onClick={() => onSelect(item.symbol)}
              >
                <strong>{item.symbol}</strong> – {item.description}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="header__menuItems">
        <a href="#">Free Stocks</a>
        <Link to="/portfolio">Portfolio</Link>        
        <a href="#">Cash</a>
        <a href="#">Messages</a>
        <a href="#">Account</a>
      </div>
    </div>
  )
}
