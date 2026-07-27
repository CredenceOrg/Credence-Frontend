import { useState, useEffect } from 'react'
import { LOCAL_STORAGE_KEYS } from '../../config/constants'
import './BreakpointOverlay.css'

export default function BreakpointOverlay() {
  const [isVisible, setIsVisible] = useState(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.DEV_BREAKPOINTS)
      return stored !== 'false' // Default to true if not set
    } catch {
      return true
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.DEV_BREAKPOINTS, String(isVisible))
    } catch {
      // ignore
    }
  }, [isVisible])

  // Vite replaces import.meta.env.DEV with a boolean at build time.
  if (!import.meta.env.DEV) return null

  return (
    <div className="breakpoint-overlay-container">
      {isVisible ? (
        <div className="breakpoint-pill" role="status" aria-live="polite">
          <span className="breakpoint-indicator" />
          <button
            className="breakpoint-close-btn"
            onClick={() => setIsVisible(false)}
            aria-label="Hide breakpoints"
            title="Hide breakpoints"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      ) : (
        <button
          className="breakpoint-toggle-btn"
          onClick={() => setIsVisible(true)}
          aria-label="Show breakpoints"
          title="Show breakpoints"
        >
          BP
        </button>
      )}
    </div>
  )
}
