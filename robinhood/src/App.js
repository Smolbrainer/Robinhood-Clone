// App.js
import "./App.css";
import Header from "./Header";
import NewsFeed from "./Newsfeed";
import Stats from "./Stats";
import React from "react";
import PortfolioPage from "./PortfolioPage"; 
import { BrowserRouter, Routes, Route, createBrowserRouter, RouterProvider } from "react-router-dom";
import StockPage from "./StockPage";
import { AuthProvider } from "./AuthContext";
import PrivateRoute from "./PrivateRoute";
import Login from "./Login";
import SignUp from "./SignUp";
import CryptoPage from './CryptoPage'
import OptionsPage from './OptionsPage'

function Home() {
  return (
    <div className="app__container">
      <NewsFeed />
      <Stats />
    </div>
  );
}

// Create router with restored homepage and separate portfolio route
const router = createBrowserRouter([
  {
    path: "/",
    element: <div className="App">
      <Header />
      <Home />
    </div>
  },
  {
    path: "/portfolio",
    element: <div className="App">
      <Header />
      <PortfolioPage />
    </div>
  },
  {
    path: "/stock/:symbol",
    element: <div className="App">
      <Header />
      <StockPage />
    </div>
  },
  {
    path: "/options/:symbol?",
    element: <div className="App">
      <Header />
      <OptionsPage />
    </div>
  },
  {
    path: "/crypto",
    element: <div className="App">
      <Header />
      <CryptoPage />
    </div>
  },
  {
    path: "/login",
    element: <div className="App">
      <Header />
      <Login />
    </div>
  },
  {
    path: "/signup",
    element: <div className="App">
      <Header />
      <SignUp />
    </div>
  }
])

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}