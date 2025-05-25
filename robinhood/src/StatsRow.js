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
    tooltip: { enabled: false },
  },
  scales: {
    x: { display: false, type: "time", time: { unit: "day" } },
    y: { display: false },
  },
  elements: {
    line: { tension: 0.3, borderWidth: 1.5 },
    point: { radius: 0 },
  },
  maintainAspectRatio: false,
};

export default function StatsRow({ symbol, openPrice, price, shares }) {
  const [chartData, setChartData] = useState([]);
  const [chartError, setChartError] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchChart() {
      try {
        const res = await fetch(
          `https://financialmodelingprep.com/api/v3/historical-price-full/${symbol}` +
            `?timeseries=1&apikey=${FMP_KEY}`
        );
        const json = await res.json();
        const hist = json.historical;
        if (Array.isArray(hist) && hist.length) {
          // FMP returns most recent first; reverse for chronological order
          const pts = hist
            .slice()
            .reverse()
            .map(({ date, close }) => ({
              x: new Date(date),
              y: close,
            }));
          setChartData(pts);
        } else {
          setChartError(true);
        }
      } catch (err) {
        console.error("Chart fetch error:", err);
        setChartError(true);
      }
    }
    fetchChart();
  }, [symbol]);

  const pct = ((price - openPrice) / openPrice) * 100;
  const isUp = pct >= 0;

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
        {shares != null && <p className="row__shares">{shares} shares</p>}
      </div>

      <div className="row__chart" style={{ width: 100, height: 40 }}>
        {chartData.length > 0 && !chartError ? (
          <Line
            data={{
              datasets: [
                {
                  data: chartData,
                  borderColor: isUp ? "#5AC53B" : "#E74C3C",
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
          style={{ color: isUp ? "#5AC53B" : "#E74C3C" }}
        >
          {isUp ? "+" : ""}
          {pct.toFixed(2)}%
        </p>
      </div>
    </div>
  );
}
