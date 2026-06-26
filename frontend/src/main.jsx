import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Camera from './pages/Camera'
import ColorAnalysis from './pages/ColorAnalysis'
import Result from './pages/Result'
import Chatbot from './pages/Chatbot'
import Wardrobe from './pages/Wardrobe'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/size-prediction" element={<Camera />} />
      <Route path="/color-analysis" element={<ColorAnalysis />} />
      <Route path="/result" element={<Result />} />
      <Route path="/fashionbot" element={<Chatbot />} />
      <Route path="/virtual-wardrobe" element={<Wardrobe />} />
    </Routes>
  </BrowserRouter>
)