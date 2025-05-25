// StatsRow.js
import React, { useState, useEffect } from "react";
import { Line } from "react-chartjs-2";
import "./Stats.css";
import StockChart from "./stock.svg";

const API_KEY = process.env.REACT_APP_FINNHUB_API_KEY;

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

export default function StatsRow({ symbol, openPrice, price }) {
  const [chartData, setChartData] = useState([]);
  const [chartError, setChartError] = useState(false);

  useEffect(() => {
    const to = Math.floor(Date.now() / 1000);
    const from = to - 7 * 24 * 60 * 60; // last 7 days

    fetch(
      `/api/v1/candle?symbol=${symbol}` +
        `&resolution=D&from=${from}&to=${to}&token=${API_KEY}`
    )
      .then((res) => res.json())
      .then((c) => {
        if (c.s === "ok" && Array.isArray(c.t) && c.t.length) {
          const pts = c.t.map((ts, i) => ({
            x: new Date(ts * 1000),
            y: c.c[i],
          }));
          setChartData(pts);
        } else {
          // server responded but no data
          setChartError(true);
        }
      })
      .catch((err) => {
        console.error("Chart fetch error:", err);
        setChartError(true);
      });
  }, [symbol]);

  const pct = ((price - openPrice) / openPrice) * 100;
  const isUp = pct >= 0;

  return (
    <div className="row">
      <div className="row__intro">
        <h1>{symbol}</h1>
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
          <img src={StockChart} alt="chart fallback" width={100} height={40} />
        )}
      </div>

      <div className="row__numbers">
        <p className="row__price">${price.toFixed(2)}</p>
        <p className={`row__percentage ${isUp ? "positive" : "negative"}`}>
          {isUp ? "+" : ""}
          {pct.toFixed(2)}%
        </p>
      </div>
    </div>
  );
}
