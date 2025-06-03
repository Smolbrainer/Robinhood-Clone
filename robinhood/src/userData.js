import { db, auth } from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  arrayUnion, 
  arrayRemove,
  query,
  where,
  getDocs
} from 'firebase/firestore';

// Get currently authenticated user
export function getCurrentUser() {
  return auth.currentUser;
}

// Initialize user's portfolio when they first sign up
export async function initializeUserPortfolio(userId) {
  const userPortfolioRef = doc(db, 'portfolios', userId);
  const portfolioDoc = await getDoc(userPortfolioRef);

  if (!portfolioDoc.exists()) {
    await setDoc(userPortfolioRef, {
      cash: 10000, // Starting cash balance
      stocks: [], // Array of stock holdings
      options: [], // Array of options positions
      optionsHistory: [], // Array of options trading history
      watchlist: [], // Array of watched stocks
      transactions: [], // Array of buy/sell transactions
      createdAt: new Date().toISOString()
    });
  }
}

// Get user's portfolio
export async function getUserPortfolio(userId) {
  try {
    const docRef = doc(db, 'portfolios', userId)
    const docSnap = await getDoc(docRef)
    
    if (docSnap.exists()) {
      const data = docSnap.data()
      return {
        cash: data.cash || 10000, // Starting cash
        stocks: data.stocks || [],
        options: data.options || [], // New: options positions
        optionsHistory: data.optionsHistory || [], // New: options trading history
        watchlist: data.watchlist || [],
        totalValue: data.totalValue || 10000,
        totalReturn: data.totalReturn || 0,
        totalReturnPercent: data.totalReturnPercent || 0
      }
    } else {
      // Create new portfolio with options support
      const newPortfolio = {
        cash: 10000,
        stocks: [],
        options: [],
        optionsHistory: [],
        watchlist: [],
        totalValue: 10000,
        totalReturn: 0,
        totalReturnPercent: 0
      }
      await setDoc(docRef, newPortfolio)
      return newPortfolio
    }
  } catch (error) {
    console.error('Error getting portfolio:', error)
    return null
  }
}

// Add stock to watchlist
export async function addToWatchlist(userId, stockSymbol) {
  const userPortfolioRef = doc(db, 'portfolios', userId);
  await updateDoc(userPortfolioRef, {
    watchlist: arrayUnion(stockSymbol)
  });
}

// Remove stock from watchlist
export async function removeFromWatchlist(userId, stockSymbol) {
  const userPortfolioRef = doc(db, 'portfolios', userId);
  await updateDoc(userPortfolioRef, {
    watchlist: arrayRemove(stockSymbol)
  });
}

// Buy stock
export async function buyStock(userId, stockData) {
  try {
    const portfolio = await getUserPortfolio(userId)
    const { symbol, shares, price } = stockData
    const totalCost = shares * price
    
    if (totalCost > portfolio.cash) {
      throw new Error('Insufficient funds')
    }
    
    // Update cash
    const newCash = portfolio.cash - totalCost
    
    // Update or add stock position
    const existingStock = portfolio.stocks.find(stock => stock.symbol === symbol)
    let newStocks
    
    if (existingStock) {
      // Update existing position
      const totalShares = existingStock.shares + shares
      const totalCost = (existingStock.shares * existingStock.averagePrice) + (shares * price)
      const newAveragePrice = totalCost / totalShares
      
      newStocks = portfolio.stocks.map(stock =>
        stock.symbol === symbol
          ? { ...stock, shares: totalShares, averagePrice: newAveragePrice }
          : stock
      )
    } else {
      // Add new position
      newStocks = [...portfolio.stocks, {
        symbol,
        shares,
        averagePrice: price,
        purchaseDate: new Date().toISOString()
      }]
    }
    
    const docRef = doc(db, 'portfolios', userId)
    await updateDoc(docRef, {
      cash: newCash,
      stocks: newStocks
    })
    
    return true
  } catch (error) {
    console.error('Error buying stock:', error)
    throw error
  }
}

// Sell stock
export async function sellStock(userId, stockData) {
  try {
    const portfolio = await getUserPortfolio(userId)
    const { symbol, shares, price } = stockData
    
    const existingStock = portfolio.stocks.find(stock => stock.symbol === symbol)
    if (!existingStock || existingStock.shares < shares) {
      throw new Error('Insufficient shares to sell')
    }
    
    const totalValue = shares * price
    const newCash = portfolio.cash + totalValue
    
    let newStocks
    if (existingStock.shares === shares) {
      // Sell all shares - remove position
      newStocks = portfolio.stocks.filter(stock => stock.symbol !== symbol)
    } else {
      // Sell partial shares - update position
      newStocks = portfolio.stocks.map(stock =>
        stock.symbol === symbol
          ? { ...stock, shares: stock.shares - shares }
          : stock
      )
    }
    
    const docRef = doc(db, 'portfolios', userId)
    await updateDoc(docRef, {
      cash: newCash,
      stocks: newStocks
    })
    
    return true
  } catch (error) {
    console.error('Error selling stock:', error)
    throw error
  }
}

// Get user's transaction history
export async function getUserTransactions(userId) {
  const userPortfolioRef = doc(db, 'portfolios', userId);
  const portfolioDoc = await getDoc(userPortfolioRef);
  
  if (portfolioDoc.exists()) {
    return portfolioDoc.data().transactions || [];
  }
  return [];
}

// Get user's watchlist
export async function getUserWatchlist(userId) {
  const userPortfolioRef = doc(db, 'portfolios', userId);
  const portfolioDoc = await getDoc(userPortfolioRef);
  
  if (portfolioDoc.exists()) {
    return portfolioDoc.data().watchlist || [];
  }
  return [];
}

// Add free cash to user's portfolio
export async function addFreeCash(userId) {
  try {
    console.log('Starting addFreeCash for user:', userId);
    
    const userPortfolioRef = doc(db, 'portfolios', userId);
    console.log('Created portfolio reference');
    
    const portfolio = await getUserPortfolio(userId);
    console.log('Current portfolio:', portfolio);
    
    if (!portfolio) {
      console.log('Portfolio not found, initializing new portfolio');
      // Initialize new portfolio if it doesn't exist
      await setDoc(userPortfolioRef, {
        cash: 11000, // Starting cash + free cash
        stocks: [],
        watchlist: [],
        transactions: [{
          type: 'deposit',
          amount: 1000,
          timestamp: new Date().toISOString()
        }],
        createdAt: new Date().toISOString()
      });
      return 11000;
    }

    const newCash = portfolio.cash + 1000; // Add $1,000
    console.log('Updating cash from', portfolio.cash, 'to', newCash);
    
    await updateDoc(userPortfolioRef, {
      cash: newCash,
      transactions: arrayUnion({
        type: 'deposit',
        amount: 1000,
        timestamp: new Date().toISOString()
      })
    });

    console.log('Successfully updated portfolio');
    return newCash;
  } catch (error) {
    console.error('Error in addFreeCash:', {
      error,
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    throw error; // Re-throw the error to be handled by the caller
  }
}

// ==================== OPTIONS TRADING FUNCTIONS ====================

// Buy option
export async function buyOption(userId, optionData) {
  try {
    console.log('🔄 Starting buyOption for user:', userId)
    console.log('📊 Option data:', optionData)
    
    const portfolio = await getUserPortfolio(userId)
    console.log('💼 Current portfolio:', portfolio)
    
    const { symbol, strike, expiration, type, contracts, premium, action, orderStyle } = optionData
    const totalCost = premium * contracts * 100 // Options are sold in contracts of 100
    
    console.log('💰 Total cost:', totalCost, 'Available cash:', portfolio.cash)
    
    if (totalCost > portfolio.cash) {
      throw new Error('Insufficient funds')
    }
    
    // Update cash
    const newCash = portfolio.cash - totalCost
    console.log('💸 New cash after purchase:', newCash)
    
    // Create option position
    const optionPosition = {
      id: `${symbol}_${strike}_${expiration}_${type}_${Date.now()}`,
      symbol,
      strike,
      expiration,
      type, // call or put
      contracts,
      premium,
      action: 'buy',
      orderStyle,
      purchaseDate: new Date().toISOString(),
      status: 'open',
      currentValue: premium * contracts * 100, // Will be updated with market value
      totalReturn: 0,
      totalReturnPercent: 0,
      side: 'long', // Add side field for portfolio display
      costBasis: premium * contracts * 100,
      unrealizedPnL: 0
    }
    
    console.log('📋 Created option position:', optionPosition)
    
    // Add to options array
    const newOptions = [...(portfolio.options || []), optionPosition]
    console.log('📦 New options array length:', newOptions.length)
    console.log('📦 New options array:', newOptions)
    
    // Add to history
    const historyEntry = {
      ...optionPosition,
      action: 'buy',
      timestamp: new Date().toISOString(),
      totalCost,
      price: premium,
      realizedPnL: 0
    }
    const newHistory = [...(portfolio.optionsHistory || []), historyEntry]
    console.log('📈 New history array length:', newHistory.length)
    
    const docRef = doc(db, 'portfolios', userId)
    const updateData = {
      cash: newCash,
      options: newOptions,
      optionsHistory: newHistory
    }
    
    console.log('🔄 Updating Firebase with:', updateData)
    
    await updateDoc(docRef, updateData)
    
    console.log('✅ Successfully updated Firebase')
    
    // Verify the update
    const verifyPortfolio = await getUserPortfolio(userId)
    console.log('✅ Verification - options count after update:', verifyPortfolio?.options?.length)
    console.log('✅ Verification - updated cash:', verifyPortfolio?.cash)
    
    return true
  } catch (error) {
    console.error('❌ Error buying option:', error)
    console.error('❌ Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    })
    throw error
  }
}

// Sell option
export async function sellOption(userId, optionData) {
  try {
    const portfolio = await getUserPortfolio(userId)
    const { symbol, strike, expiration, type, contracts, premium } = optionData
    
    // Find matching option position
    const existingOption = portfolio.options.find(option => 
      option.symbol === symbol &&
      option.strike === strike &&
      option.expiration === expiration &&
      option.type === type &&
      option.status === 'open'
    )
    
    if (!existingOption || existingOption.contracts < contracts) {
      throw new Error('Insufficient option contracts to sell')
    }
    
    const totalValue = premium * contracts * 100
    const newCash = portfolio.cash + totalValue
    
    let newOptions
    if (existingOption.contracts === contracts) {
      // Sell all contracts - close position
      newOptions = portfolio.options.map(option =>
        option.id === existingOption.id
          ? { ...option, status: 'closed', closeDate: new Date().toISOString(), closePremium: premium }
          : option
      )
    } else {
      // Sell partial contracts - update position
      newOptions = portfolio.options.map(option =>
        option.id === existingOption.id
          ? { ...option, contracts: option.contracts - contracts }
          : option
      )
    }
    
    // Add to history
    const historyEntry = {
      id: `${symbol}_${strike}_${expiration}_${type}_${Date.now()}_sell`,
      symbol,
      strike,
      expiration,
      type,
      contracts,
      premium,
      action: 'sell',
      timestamp: new Date().toISOString(),
      totalValue,
      originalPositionId: existingOption.id
    }
    const newHistory = [...portfolio.optionsHistory, historyEntry]
    
    const docRef = doc(db, 'portfolios', userId)
    await updateDoc(docRef, {
      cash: newCash,
      options: newOptions,
      optionsHistory: newHistory
    })
    
    return true
  } catch (error) {
    console.error('Error selling option:', error)
    throw error
  }
}

// Exercise option
export async function exerciseOption(userId, optionId) {
  try {
    const portfolio = await getUserPortfolio(userId)
    
    const option = portfolio.options.find(opt => opt.id === optionId && opt.status === 'open')
    if (!option) {
      throw new Error('Option position not found or already closed')
    }
    
    if (option.type === 'call') {
      // Exercise call option - buy stock at strike price
      const totalCost = option.strike * option.contracts * 100
      
      if (totalCost > portfolio.cash) {
        throw new Error('Insufficient funds to exercise call option')
      }
      
      // Buy stock at strike price
      await buyStock(userId, {
        symbol: option.symbol,
        shares: option.contracts * 100,
        price: option.strike
      })
      
    } else {
      // Exercise put option - sell stock at strike price
      const existingStock = portfolio.stocks.find(stock => stock.symbol === option.symbol)
      const requiredShares = option.contracts * 100
      
      if (!existingStock || existingStock.shares < requiredShares) {
        throw new Error('Insufficient shares to exercise put option')
      }
      
      // Sell stock at strike price
      await sellStock(userId, {
        symbol: option.symbol,
        shares: requiredShares,
        price: option.strike
      })
    }
    
    // Close the option position
    const newOptions = portfolio.options.map(opt =>
      opt.id === optionId
        ? { ...opt, status: 'exercised', exerciseDate: new Date().toISOString() }
        : opt
    )
    
    // Add to history
    const historyEntry = {
      ...option,
      action: 'exercise',
      timestamp: new Date().toISOString()
    }
    const newHistory = [...portfolio.optionsHistory, historyEntry]
    
    const docRef = doc(db, 'portfolios', userId)
    await updateDoc(docRef, {
      options: newOptions,
      optionsHistory: newHistory
    })
    
    return true
  } catch (error) {
    console.error('Error exercising option:', error)
    throw error
  }
}

// Update option values (to be called periodically)
export async function updateOptionValues(userId, optionsMarketData) {
  try {
    const portfolio = await getUserPortfolio(userId)
    
    const updatedOptions = portfolio.options.map(option => {
      if (option.status !== 'open') return option
      
      const marketData = optionsMarketData.find(data =>
        data.symbol === option.symbol &&
        data.strike === option.strike &&
        data.expiration === option.expiration &&
        data.type === option.type
      )
      
      if (marketData) {
        const currentValue = marketData.lastPrice * option.contracts * 100
        const totalReturn = currentValue - (option.premium * option.contracts * 100)
        const totalReturnPercent = ((currentValue / (option.premium * option.contracts * 100)) - 1) * 100
        
        return {
          ...option,
          currentValue,
          totalReturn,
          totalReturnPercent,
          lastUpdated: new Date().toISOString()
        }
      }
      
      return option
    })
    
    const docRef = doc(db, 'portfolios', userId)
    await updateDoc(docRef, {
      options: updatedOptions
    })
    
    return true
  } catch (error) {
    console.error('Error updating option values:', error)
    throw error
  }
}

// Get options positions
export async function getOptionsPositions(userId) {
  try {
    console.log('🔍 Getting options positions for user:', userId)
    const portfolio = await getUserPortfolio(userId)
    console.log('💼 Portfolio retrieved:', portfolio)
    console.log('📊 Raw options array:', portfolio?.options)
    console.log('📊 Options array length:', portfolio?.options?.length)
    
    const openPositions = portfolio?.options?.filter(option => option.status === 'open') || []
    console.log('🔓 Open positions found:', openPositions.length)
    console.log('🔓 Open positions:', openPositions)
    
    return openPositions
  } catch (error) {
    console.error('❌ Error getting options positions:', error)
    return []
  }
}

// Get options trading history
export async function getOptionsHistory(userId) {
  try {
    console.log('📈 Getting options history for user:', userId)
    const portfolio = await getUserPortfolio(userId)
    console.log('💼 Portfolio for history:', portfolio)
    console.log('📈 Raw history array:', portfolio?.optionsHistory)
    console.log('📈 History array length:', portfolio?.optionsHistory?.length)
    
    const sortedHistory = (portfolio?.optionsHistory || []).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    console.log('📈 Sorted history:', sortedHistory)
    
    return sortedHistory
  } catch (error) {
    console.error('❌ Error getting options history:', error)
    return []
  }
}

// Calculate portfolio Greeks (aggregate risk metrics)
export function calculatePortfolioGreeks(optionsPositions) {
  let totalDelta = 0
  let totalGamma = 0
  let totalTheta = 0
  let totalVega = 0
  let totalRho = 0
  
  optionsPositions.forEach(option => {
    if (option.status === 'open') {
      const multiplier = option.contracts * 100
      totalDelta += (option.delta || 0) * multiplier
      totalGamma += (option.gamma || 0) * multiplier
      totalTheta += (option.theta || 0) * multiplier
      totalVega += (option.vega || 0) * multiplier
      totalRho += (option.rho || 0) * multiplier
    }
  })
  
  return {
    delta: totalDelta,
    gamma: totalGamma,
    theta: totalTheta,
    vega: totalVega,
    rho: totalRho
  }
}

// ==================== DEBUG FUNCTIONS ====================

// Test function to debug options trading
export async function debugOptionsTrading(userId) {
  try {
    console.log('🧪 Starting options trading debug for user:', userId)
    
    // Get current portfolio
    const portfolio = await getUserPortfolio(userId)
    console.log('📋 Current portfolio:', portfolio)
    
    // Test buying an option
    const testOption = {
      symbol: 'AAPL',
      strike: 200,
      expiration: '2024-12-20',
      type: 'call',
      contracts: 1,
      premium: 5.50,
      action: 'buy',
      orderStyle: 'market'
    }
    
    console.log('🎯 Testing with option:', testOption)
    
    await buyOption(userId, testOption)
    
    // Verify positions
    const positions = await getOptionsPositions(userId)
    console.log('✅ Positions after test:', positions)
    
    return {
      success: true,
      positions: positions.length,
      message: `Successfully created ${positions.length} position(s)`
    }
  } catch (error) {
    console.error('❌ Debug test failed:', error)
    return {
      success: false,
      error: error.message
    }
  }
} 