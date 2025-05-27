import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'
import { useAuth } from './AuthContext'
import { buyCrypto, sellCrypto, getCryptoHoldings } from './cryptoData'
import { db } from './firebase'
import { doc, getDoc } from 'firebase/firestore'
import './CryptoPage.css'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
)

const FMP_KEY = process.env.REACT_APP_FMP_KEY || "X5t0qm3ru74kZNRha7rSywlO8At81XrG"

export default function CryptoPage() {
  const { symbol } = useParams()
  const { currentUser } = useAuth()
  const [cryptoData, setCryptoData] = useState(null)
  const [historicalData, setHistoricalData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [orderType, setOrderType] = useState('buy')
  const [amount, setAmount] = useState('')
  const [userCash, setUserCash] = useState(0)
  const [userHoldings, setUserHoldings] = useState(0)
  const [orderSuccess, setOrderSuccess] = useState('')
  const [orderError, setOrderError] = useState('')

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000) // Update every 30 seconds
    return () => clearInterval(interval)
  }, [symbol])

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch current crypto data
      const response = await fetch(
        `https://financialmodelingprep.com/stable/quote?symbol=${symbol}&apikey=${FMP_KEY}`
      )
      const data = await response.json()
      
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('Failed to fetch crypto data')
      }

      setCryptoData(data[0])

      // Fetch historical data
      const historicalResponse = await fetch(
        `https://financialmodelingprep.com/api/v3/historical-price-full/${symbol}?apikey=${FMP_KEY}`
      )
      const historicalData = await historicalResponse.json()
      
      if (!historicalData.historical) {
        throw new Error('Failed to fetch historical data')
      }

      setHistoricalData(historicalData.historical)

      // Fetch user data
      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid)
        const userDoc = await getDoc(userRef)
        if (userDoc.exists()) {
          const userData = userDoc.data()
          setUserCash(userData.cash || 0)
          const holdings = await getCryptoHoldings(currentUser.uid)
          setUserHoldings(holdings[symbol] || 0)
        }
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleOrder = async (e) => {
    e.preventDefault()
    setOrderSuccess('')
    setOrderError('')

    if (!currentUser) {
      setOrderError('Please log in to trade')
      return
    }

    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      setOrderError('Please enter a valid amount')
      return
    }

    try {
      if (orderType === 'buy') {
        await buyCrypto(currentUser.uid, symbol, amountNum)
        setOrderSuccess('Buy order executed successfully')
      } else {
        await sellCrypto(currentUser.uid, symbol, amountNum)
        setOrderSuccess('Sell order executed successfully')
      }
      setAmount('')
      fetchData() // Refresh data after order
    } catch (err) {
      setOrderError(err.message)
    }
  }

  if (loading) return <div className="cryptoPage__loading">Loading...</div>
  if (error) return <div className="cryptoPage__error">{error}</div>
  if (!cryptoData) return <div className="cryptoPage__error">Crypto not found</div>

  const chartData = {
    labels: historicalData.map(item => new Date(item.date).toLocaleDateString()),
    datasets: [
      {
        label: 'Price',
        data: historicalData.map(item => item.close),
        fill: false,
        borderColor: '#00C805',
        tension: 0.4
      }
    ]
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: '#333',
        borderWidth: 1
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        },
        ticks: {
          color: '#888',
          maxRotation: 0
        }
      },
      y: {
        grid: {
          color: '#333'
        },
        ticks: {
          color: '#888'
        }
      }
    }
  }

  const quantity = amount ? parseFloat(amount) / cryptoData.price : 0

  return (
    <div className="cryptoPage">
      <div className="cryptoPage__content">
        <div className="cryptoPage__left">
          <div className="cryptoPage__header">
            <h1>{cryptoData.name} ({cryptoData.symbol})</h1>
            <div className="cryptoPage__price">
              ${cryptoData.price.toFixed(2)}
              <span className={cryptoData.changesPercentage >= 0 ? 'positive' : 'negative'}>
                {cryptoData.changesPercentage >= 0 ? '+' : ''}{cryptoData.changesPercentage.toFixed(2)}%
              </span>
            </div>
          </div>

          <div className="cryptoPage__chartWrapper">
            <Line data={chartData} options={chartOptions} />
          </div>

          <div className="cryptoPage__stats">
            <div className="cryptoPage__stat">
              <span>Market Cap</span>
              <span>${(cryptoData.marketCap / 1e9).toFixed(2)}B</span>
            </div>
            <div className="cryptoPage__stat">
              <span>Volume</span>
              <span>${(cryptoData.volume / 1e6).toFixed(2)}M</span>
            </div>
            <div className="cryptoPage__stat">
              <span>Your Holdings</span>
              <span>{userHoldings.toFixed(8)} {symbol}</span>
            </div>
          </div>
        </div>

        <div className="cryptoPage__right">
          <div className="cryptoPage__orderPanel">
            <div className="cryptoPage__orderTabs">
              <button
                className={orderType === 'buy' ? 'active' : ''}
                onClick={() => setOrderType('buy')}
              >
                Buy
              </button>
              <button
                className={orderType === 'sell' ? 'active' : ''}
                onClick={() => setOrderType('sell')}
              >
                Sell
              </button>
            </div>

            <form onSubmit={handleOrder} className="cryptoPage__orderForm">
              <div className="cryptoPage__orderInput">
                <label>Amount in USD</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  required
                />
              </div>

              <div className="cryptoPage__orderSummary">
                <div className="cryptoPage__orderRow">
                  <span>Price</span>
                  <span>${cryptoData.price.toFixed(2)}</span>
                </div>
                <div className="cryptoPage__orderRow">
                  <span>Quantity</span>
                  <span>{quantity.toFixed(8)} {symbol}</span>
                </div>
                {orderType === 'buy' && (
                  <div className="cryptoPage__orderRow">
                    <span>Available Cash</span>
                    <span>${userCash.toFixed(2)}</span>
                  </div>
                )}
                {orderType === 'sell' && (
                  <div className="cryptoPage__orderRow">
                    <span>Your Holdings</span>
                    <span>{userHoldings.toFixed(8)} {symbol}</span>
                  </div>
                )}
              </div>

              {orderError && <div className="cryptoPage__orderError">{orderError}</div>}
              {orderSuccess && <div className="cryptoPage__orderSuccess">{orderSuccess}</div>}

              <button
                type="submit"
                className={`cryptoPage__orderButton ${orderType}`}
                disabled={!amount || parseFloat(amount) <= 0}
              >
                {orderType === 'buy' ? 'Buy' : 'Sell'} {symbol}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
} 