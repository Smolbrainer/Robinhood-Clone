// Header.js
import React, { useState, useEffect, useRef } from 'react'
import { FaSearch } from 'react-icons/fa'
import { useNavigate } from 'react-router-dom'
import logo from './robinhood.svg'
import './Header.css'
import { Link } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { addFreeCash } from './userData'

const API_KEY = process.env.REACT_APP_FINNHUB_API_KEY
const FMP_KEY = process.env.REACT_APP_FMP_KEY || "X5t0qm3ru74kZNRha7rSywlO8At81XrG"

export default function Header() {
  const [searchTerm, setSearchTerm] = useState("")
  const [searchResults, setSearchResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const containerRef = useRef()
  const navigate = useNavigate()
  const { currentUser, logout } = useAuth()

  // Sample stock symbols for suggestions
  const popularStocks = [
    'AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX',
    'UBER', 'SNAP', 'TWTR', 'ORCL', 'CRM', 'ADBE', 'INTC', 'AMD'
  ]

  useEffect(() => {
    const searchAssets = async () => {
      if (!searchTerm) {
        setSearchResults([])
        setShowDropdown(false)
        return
      }

      setLoading(true)
      setShowDropdown(true)
      try {
        // Get search suggestions
        const searchResponse = await fetch(
          `https://financialmodelingprep.com/stable/search-symbol?query=${searchTerm}&apikey=${FMP_KEY}`
        )
        const searchData = await searchResponse.json()

        // Format results
        const formattedResults = Array.isArray(searchData) ? searchData.map(item => ({
          ...item,
          type: item.exchange === 'CRYPTO' ? 'crypto' : 'stock',
          displaySymbol: item.symbol,
          displayName: item.name,
          exchangeName: item.exchangeFullName
        })) : []

        console.log('Search results:', formattedResults) // Debug log
        setSearchResults(formattedResults)
      } catch (error) {
        console.error('Error searching:', error)
        setSearchResults([])
      } finally {
        setLoading(false)
      }
    }

    const timeoutId = setTimeout(searchAssets, 300) // Reduced debounce time for better responsiveness
    return () => clearTimeout(timeoutId)
  }, [searchTerm])

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

  const handleResultClick = async (result) => {
    setSearchTerm("")
    setSearchResults([])
    setShowDropdown(false)

    try {
      // Get detailed quote for the selected item
      const quoteResponse = await fetch(
        `https://financialmodelingprep.com/stable/quote?symbol=${result.symbol}&apikey=${FMP_KEY}`
      )
      const quoteData = await quoteResponse.json()

      if (Array.isArray(quoteData) && quoteData.length > 0) {
        if (quoteData[0].exchange === 'CRYPTO') {
          navigate(`/crypto/${result.symbol}`)
        } else {
          navigate(`/stock/${result.symbol}`)
        }
      }
    } catch (error) {
      console.error('Error fetching quote:', error)
    }
  }

  const handleLogout = async () => {
    try {
      await logout()
      navigate('/login')
    } catch {
      alert('Failed to log out')
    }
  }

  async function handleFreeCash() {
    if (!currentUser) {
      alert('Please log in to get free cash');
      return;
    }
    
    try {
      console.log('Adding free cash for user:', currentUser.uid);
      const newCash = await addFreeCash(currentUser.uid);
      console.log('Successfully added free cash. New balance:', newCash);
      alert('Added $1,000 to your account!');
      window.location.reload(); // Refresh to update portfolio
    } catch (error) {
      console.error('Detailed error adding free cash:', {
        error,
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      alert('Failed to add free cash. Please try again.');
    }
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
      >
        <div className="header__searchContainer">
          <FaSearch className="searchIcon" />
          <input
            placeholder="Search stocks or crypto..."
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => setShowDropdown(true)}
          />
        </div>

        {showDropdown && (
          <div className="header__searchResults">
            {loading ? (
              <div className="header__searchLoading">Loading...</div>
            ) : searchResults.length > 0 ? (
              searchResults.map((result) => (
                <div
                  key={result.symbol}
                  className="header__searchResult"
                  onClick={() => handleResultClick(result)}
                >
                  <div className="header__searchResult__info">
                    <div className="header__searchResult__symbol">
                      {result.displaySymbol}
                      <span className="header__searchResult__type">
                        {result.type === 'crypto' ? 'Crypto' : 'Stock'}
                      </span>
                    </div>
                    <div className="header__searchResult__name">
                      {result.displayName}
                      <span className="header__searchResult__exchange">
                        {result.exchangeName}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            ) : searchTerm && !loading ? (
              <div className="header__searchNoResults">No results found</div>
            ) : null}
          </div>
        )}
      </div>

      <div className="header__menuItems">
        {currentUser ? (
          <>
            <button onClick={handleFreeCash} className="freeCashButton">
              Get Free Cash
            </button>
            <Link to="/portfolio">Portfolio</Link>
            <Link to="/options">Options</Link>
            <Link to="/crypto">Crypto</Link>
            <button onClick={handleLogout} className="logoutButton">
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="loginButton">
              Login
            </Link>
            <Link to="/signup" className="signupButton">
              Sign Up
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
