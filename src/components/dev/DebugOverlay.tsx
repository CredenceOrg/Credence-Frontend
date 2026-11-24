import { useState } from 'react'
import { FEATURE_FLAG_LABELS, type FeatureFlagName } from '../../config/featureFlags'
import { useFeatureFlag, useFeatureFlags } from '../../context/FeatureFlagContext'
import './DebugOverlay.css'

/**
 * Debug overlay that appears when the URL contains `?debug=1` (or any
 * other feature-flag param is set).
 *
 * Shows the current state of every registered feature flag and lets
 * developers inspect which flags are active at a glance.
 *
 * Only rendered in dev mode (`import.meta.env.DEV`).
 */
export default function DebugOverlay() {
  const [isOpen, setIsOpen] = useState(false)
  const debugEnabled = useFeatureFlag('debug')
  const flags = useFeatureFlags()

  if (!import.meta.env.DEV) return null
  if (!debugEnabled) return null

  const entries = Object.entries(FEATURE_FLAG_LABELS) as Array<[FeatureFlagName, string]>

  return (
    <>
      <button
        className="debug-overlay-toggle"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? 'Close debug toggle' : 'Open debug overlay'}
        title={isOpen ? 'Close debug overlay' : 'Open debug overlay'}
      >
        D
      </button>

      {isOpen && (
        <div className="debug-overlay-panel" role="dialog" aria-label="Feature flags debug overlay">
          <div className="debug-overlay-header">
            <span className="debug-overlay-title">Feature Flags</span>
            <button
              className="debug-overlay-close"
              onClick={() => setIsOpen(false)}
              aria-label="Close debug overlay"
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
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <ul className="debug-overlay-list">
            {entries.map(([key, label]) => (
              <li key={key} className="debug-overlay-item">
                <span className="debug-overlay-label">{label}</span>
                <span
                  className={`debug-overlay-badge ${flags[key] ? 'debug-overlay-badge--on' : 'debug-overlay-badge--off'}`}
                  data-testid={`flag-${key}`}
                >
                  {flags[key] ? 'ON' : 'OFF'}
                </span>
              </li>
            ))}
          </ul>

          <div className="debug-overlay-hint">
            Set flags via URL: <code>?debug=1&nbsp;newDashboard=1</code>
          </div>
        </div>
      )}
    </>
  )
}
