// App.js
import "./App.css";
import Header from "./Header";
import NewsFeed from "./Newsfeed";
import Stats from "./Stats";
import React from "react";
import PortfolioPage from "./PortfolioPage"; 
import { BrowserRouter, Routes, Route } from "react-router-dom";
import StockPage from "./StockPage";
import { AuthProvider } from "./AuthContext";
import PrivateRoute from "./PrivateRoute";
import Login from "./Login";
import SignUp from "./SignUp";
import CryptoPage from './CryptoPage'

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
      <AuthProvider>
        <div className="app">
          <div className="app__body">
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<SignUp />} />
              
              <Route
                path="/"
                element={
                  <PrivateRoute>
                    <>
                      <Header />
                      <Home />
                    </>
                  </PrivateRoute>
                }
              />

              <Route
                path="/stock/:symbol"
                element={
                  <PrivateRoute>
                    <>
                      <Header />
                      <StockPage />
                    </>
                  </PrivateRoute>
                }
              />

              <Route
                path="/crypto/:symbol"
                element={
                  <PrivateRoute>
                    <>
                      <Header />
                      <CryptoPage />
                    </>
                  </PrivateRoute>
                }
              />

              <Route
                path="/portfolio"
                element={
                  <PrivateRoute>
                    <PortfolioPage />
                  </PrivateRoute>
                }
              />
            </Routes>
          </div>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}