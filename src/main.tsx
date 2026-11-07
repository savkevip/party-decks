import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { GuestPage } from './GuestPage'
import { isGuestPage } from './guests'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isGuestPage() ? <GuestPage /> : <App />}
  </StrictMode>,
)
