// Stats.js
import React, { useState, useEffect } from "react";
import "./Stats.css";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import StatsRow from "./StatsRow";
import axios from "axios";
import { db } from "./firebase";
import { collection, onSnapshot } from "firebase/firestore";

const BASE_URL = "https://finnhub.io/api/v1/quote?symbol=";
const KEY_URL = `&token=${process.env.REACT_APP_FINNHUB_API_KEY}`;

export default function Stats() {
  const [stocksData, setStocksData] = useState([]);
  const [myStocks, setMyStocks] = useState([]);

  // helper to fetch quote data for a given symbol
  const getStocksData = (symbol) => axios.get(`${BASE_URL}${symbol}${KEY_URL}`);

  // load user-saved stocks from Firestore (modular API)
  const getMyStocks = () => {
    const myStocksRef = collection(db, 'myStocks');
    onSnapshot(myStocksRef, (snapshot) => {
      const promises = [];
      const tempData = [];

      snapshot.docs.forEach((doc) => {
        const ticker = doc.data().ticker;
        promises.push(
          getStocksData(ticker).then((res) => {
            tempData.push({
              id: doc.id,
              data: doc.data(),
              info: res.data,
            });
          })
        );
      });

      Promise.all(promises).then(() => setMyStocks(tempData));
    });
  };

  useEffect(() => {
    getMyStocks();

    // fetch a predefined list of symbols
    const symbols = ["AAPL", "MSFT"];
    const promises = [];
    const tempStocks = [];

    symbols.forEach((sym) => {
      promises.push(
        getStocksData(sym).then((res) => {
          tempStocks.push({ name: sym, ...res.data });
        })
      );
    });

    Promise.all(promises)
      .then(() => setStocksData(tempStocks))
      .catch((err) => console.error("Failed to load stock list:", err));
  }, []);

  return (
    <div className="stats">
      <div className="stats__container">

        {/* Top: User's personal watchlist */}
        <div className="stats__header">
          <p>Stocks</p>
          <MoreHorizIcon />
        </div>
        <div className="stats__content">
          <div className="stats__rows">
            {myStocks.map((stock) => (
              <StatsRow
                key={stock.id}
                symbol={stock.data.ticker}
                openPrice={stock.info.o}
                volume={stock.data.shares}
                price={stock.info.c}
                shares={stock.data.shares}
              />
            ))}
          </div>
        </div>

        {/* Bottom: Predefined list */}
        <div className="stats__header stats-lists">
          <p>Lists</p>
        </div>
        <div className="stats__content">
          <div className="stats__rows">
            {stocksData.map((stock) => (
              <StatsRow
                key={stock.name}
                symbol={stock.name}
                openPrice={stock.o}
                price={stock.c}
              />
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
