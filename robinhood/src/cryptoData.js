import { db } from './firebase'
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore'

export async function buyCrypto(userId, symbol, amount) {
  const userRef = doc(db, 'users', userId)
  const userDoc = await getDoc(userRef)
  
  if (!userDoc.exists()) {
    throw new Error('User not found')
  }

  const userData = userDoc.data()
  const currentCash = userData.cash || 0

  if (amount > currentCash) {
    throw new Error('Insufficient funds')
  }

  // Get current crypto price
  const response = await fetch(
    `https://financialmodelingprep.com/stable/quote?symbol=${symbol}&apikey=${process.env.REACT_APP_FMP_KEY}`
  )
  const data = await response.json()
  
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Failed to fetch crypto price')
  }

  const price = data[0].price
  const quantity = amount / price

  // Update user's portfolio
  const portfolio = userData.portfolio || {}
  const cryptoHoldings = portfolio.crypto || {}
  const currentQuantity = cryptoHoldings[symbol] || 0

  await updateDoc(userRef, {
    cash: currentCash - amount,
    portfolio: {
      ...portfolio,
      crypto: {
        ...cryptoHoldings,
        [symbol]: currentQuantity + quantity
      }
    },
    transactions: arrayUnion({
      type: 'buy',
      symbol,
      quantity,
      price,
      amount,
      timestamp: new Date().toISOString()
    })
  })
}

export async function sellCrypto(userId, symbol, amount) {
  const userRef = doc(db, 'users', userId)
  const userDoc = await getDoc(userRef)
  
  if (!userDoc.exists()) {
    throw new Error('User not found')
  }

  const userData = userDoc.data()
  const portfolio = userData.portfolio || {}
  const cryptoHoldings = portfolio.crypto || {}
  const currentQuantity = cryptoHoldings[symbol] || 0

  // Get current crypto price
  const response = await fetch(
    `https://financialmodelingprep.com/stable/quote?symbol=${symbol}&apikey=${process.env.REACT_APP_FMP_KEY}`
  )
  const data = await response.json()
  
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Failed to fetch crypto price')
  }

  const price = data[0].price
  const quantity = amount / price

  if (quantity > currentQuantity) {
    throw new Error('Insufficient crypto holdings')
  }

  // Update user's portfolio
  await updateDoc(userRef, {
    cash: (userData.cash || 0) + amount,
    portfolio: {
      ...portfolio,
      crypto: {
        ...cryptoHoldings,
        [symbol]: currentQuantity - quantity
      }
    },
    transactions: arrayUnion({
      type: 'sell',
      symbol,
      quantity,
      price,
      amount,
      timestamp: new Date().toISOString()
    })
  })
}

export async function getCryptoHoldings(userId) {
  const userRef = doc(db, 'users', userId)
  const userDoc = await getDoc(userRef)
  
  if (!userDoc.exists()) {
    throw new Error('User not found')
  }

  const userData = userDoc.data()
  return userData.portfolio?.crypto || {}
} 