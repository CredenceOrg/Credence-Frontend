import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { initErrorReporting } from './lib/errorReporting'
import './i18n/config'
import './index.css'

// Opt-in: resolves immediately when VITE_SENTRY_DSN is empty, and never blocks
// the first render.
void initErrorReporting()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
