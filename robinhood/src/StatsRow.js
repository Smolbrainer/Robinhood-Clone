// StatsRow.js
import React, { useState, useEffect, useMemo } from "react";
import { Line } from "react-chartjs-2";
import { useNavigate } from "react-router-dom";
import "./Stats.css";
import StockChart from "./stock.svg";
import StockChart2 from "./stock2.svg";
import negativeStockChart2 from "./negStock.svg";

const FMP_KEY = process.env.REACT_APP_FMP_KEY || "X5t0qm3ru74kZNRha7rSywlO8At81XrG";

const sparkOptions = {
  plugins: {
    legend: { display: false },
    tooltip: { enabled: false }
  },
  scales: {
    x: { 
      display: false,
      type: "time",
      time: { unit: "hour" }
    },
    y: { 
      display: false
    }
  },
  elements: {
    line: { 
      tension: 0.3, 
      borderWidth: 1.5 
    },
    point: { 
      radius: 0
    }
  },
  maintainAspectRatio: false
};

export default function StatsRow({ symbol, openPrice, price, shares, change }) {
  const [chartData, setChartData] = useState([]);
  const [chartError, setChartError] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchChartData() {
      try {
        const response = await fetch(
          `https://financialmodelingprep.com/api/v3/historical-chart/1day/${symbol}?apikey=${FMP_KEY}`
        );
        const data = await response.json();
        
        if (data && data.length > 0) {
          const formattedData = data.reverse().map(item => ({
            x: new Date(item.date),
            y: item.close
          }));
          setChartData(formattedData);
        }
      } catch (err) {
        console.error('Error fetching chart data:', err);
        setChartError(true);
      }
    }
    fetchChartData();
  }, [symbol]);

  const isUp = change >= 0;

  const fallbackChart = useMemo(() => {
    if (!isUp) return negativeStockChart2;
    return Math.random() < 0.5 ? StockChart : StockChart2;
  }, [isUp]);

  return (
    <div
      className="row"
      onClick={() => navigate(`/stock/${symbol}`)}
      style={{ cursor: "pointer" }}
    >
      <div className="row__intro">
        <h1>{symbol}</h1>
        {shares > 0 && <p className="row__shares">{shares} shares</p>}
      </div>

      <div className="row__chart" style={{ width: 100, height: 40 }}>
        {chartData.length > 0 && !chartError ? (
          <Line
            data={{
              datasets: [
                {
                  data: chartData,
                  borderColor: isUp ? "#00C805" : "#ff4d4d",
                  fill: false,
                },
              ],
            }}
            options={sparkOptions}
            redraw
          />
        ) : (
          <img
            src={fallbackChart}
            alt="chart fallback"
            width={100}
            height={40}
          />
        )}
      </div>

      <div className="row__numbers">
        <p className="row__price">${price.toFixed(2)}</p>
        <p
          className="row__percentage"
          style={{ color: isUp ? "#00C805" : "#ff4d4d" }}
        >
          {isUp ? "+" : ""}
          {change.toFixed(2)}%
        </p>
      </div>
    </div>
  );
}
