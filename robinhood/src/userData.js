import { db } from './firebase';
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

// Initialize user's portfolio when they first sign up
export async function initializeUserPortfolio(userId) {
  const userPortfolioRef = doc(db, 'portfolios', userId);
  const portfolioDoc = await getDoc(userPortfolioRef);

  if (!portfolioDoc.exists()) {
    await setDoc(userPortfolioRef, {
      cash: 10000, // Starting cash balance
      stocks: [], // Array of stock holdings
      watchlist: [], // Array of watched stocks
      transactions: [], // Array of buy/sell transactions
      createdAt: new Date().toISOString()
    });
  }
}

// Get user's portfolio
export async function getUserPortfolio(userId) {
  const userPortfolioRef = doc(db, 'portfolios', userId);
  const portfolioDoc = await getDoc(userPortfolioRef);
  
  if (portfolioDoc.exists()) {
    return portfolioDoc.data();
  }
  return null;
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
  console.log('Starting buyStock for user:', userId, 'stock data:', stockData);
  
  const userPortfolioRef = doc(db, 'portfolios', userId);
  const portfolio = await getUserPortfolio(userId);
  
  if (!portfolio) {
    console.error('Portfolio not found for user:', userId);
    throw new Error('Portfolio not found');
  }

  console.log('Current portfolio:', portfolio);

  const transaction = {
    type: 'buy',
    symbol: stockData.symbol,
    shares: stockData.shares,
    price: stockData.price,
    total: stockData.shares * stockData.price,
    timestamp: new Date().toISOString()
  };

  console.log('Creating transaction:', transaction);

  // Update cash balance
  const newCash = portfolio.cash - transaction.total;
  console.log('Updating cash from', portfolio.cash, 'to', newCash);
  
  // Update or add stock to holdings
  const existingStockIndex = portfolio.stocks.findIndex(
    stock => stock.symbol === stockData.symbol
  );

  let updatedStocks = [...(portfolio.stocks || [])];
  console.log('Current stocks:', updatedStocks);

  if (existingStockIndex >= 0) {
    console.log('Updating existing stock position');
    const existingStock = updatedStocks[existingStockIndex];
    const totalShares = existingStock.shares + stockData.shares;
    const totalCost = (existingStock.averagePrice * existingStock.shares) + 
                     (stockData.price * stockData.shares);
    const newAveragePrice = totalCost / totalShares;

    updatedStocks[existingStockIndex] = {
      ...existingStock,
      shares: totalShares,
      averagePrice: newAveragePrice
    };
  } else {
    console.log('Adding new stock position');
    updatedStocks.push({
      symbol: stockData.symbol,
      shares: stockData.shares,
      averagePrice: stockData.price
    });
  }

  console.log('Updated stocks:', updatedStocks);

  try {
    await updateDoc(userPortfolioRef, {
      cash: newCash,
      stocks: updatedStocks,
      transactions: arrayUnion(transaction)
    });
    console.log('Successfully updated portfolio');
  } catch (error) {
    console.error('Error updating portfolio:', error);
    throw error;
  }
}

// Sell stock
export async function sellStock(userId, stockData) {
  console.log('Starting sellStock for user:', userId, 'stock data:', stockData);
  
  const userPortfolioRef = doc(db, 'portfolios', userId);
  const portfolio = await getUserPortfolio(userId);
  
  if (!portfolio) {
    console.error('Portfolio not found for user:', userId);
    throw new Error('Portfolio not found');
  }

  console.log('Current portfolio:', portfolio);
  
  const transaction = {
    type: 'sell',
    symbol: stockData.symbol,
    shares: stockData.shares,
    price: stockData.price,
    total: stockData.shares * stockData.price,
    timestamp: new Date().toISOString()
  };

  console.log('Creating transaction:', transaction);

  // Update cash balance
  const newCash = portfolio.cash + transaction.total;
  console.log('Updating cash from', portfolio.cash, 'to', newCash);
  
  // Update stock holdings
  const existingStockIndex = portfolio.stocks.findIndex(
    stock => stock.symbol === stockData.symbol
  );

  if (existingStockIndex >= 0) {
    const existingStock = portfolio.stocks[existingStockIndex];
    console.log('Found existing stock position:', existingStock);

    if (existingStock.shares < stockData.shares) {
      console.error('Not enough shares to sell');
      throw new Error('Not enough shares to sell');
    }

    let updatedStocks = [...portfolio.stocks];
    if (existingStock.shares === stockData.shares) {
      console.log('Removing stock position completely');
      updatedStocks = updatedStocks.filter(stock => stock.symbol !== stockData.symbol);
    } else {
      console.log('Updating remaining shares');
      updatedStocks[existingStockIndex] = {
        ...existingStock,
        shares: existingStock.shares - stockData.shares
      };
    }

    console.log('Updated stocks:', updatedStocks);

    try {
      await updateDoc(userPortfolioRef, {
        cash: newCash,
        stocks: updatedStocks,
        transactions: arrayUnion(transaction)
      });
      console.log('Successfully updated portfolio');
    } catch (error) {
      console.error('Error updating portfolio:', error);
      throw error;
    }
  } else {
    console.error('Stock not found in portfolio');
    throw new Error('Stock not found in portfolio');
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