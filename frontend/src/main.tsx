import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import 'leaflet/dist/leaflet.css'
import './base.css'
import App from './App'
import ScreenErrorBoundary from './site/components/ScreenErrorBoundary'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ScreenErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ScreenErrorBoundary>
  </StrictMode>,
)
