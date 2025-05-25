// App.js
import "./App.css";
import Header from "./Header";
import NewsFeed from "./Newsfeed";
import Stats from "./Stats";
import React from "react";
import PortfolioPage from "./PortfolioPage"; 
import { BrowserRouter, Routes, Route } from "react-router-dom";
import StockPage from "./StockPage";

function Home() {
  return (
    <div className="app__container">
      <NewsFeed />
      <Stats />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <div className="app__header">
          <Header />
        </div>

        <div className="app__body">
          <Routes>
            <Route path="/" element={<Home />} />

            <Route path="/stock/:symbol" element={<StockPage />} />

            <Route path="/portfolio" element={<PortfolioPage />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}