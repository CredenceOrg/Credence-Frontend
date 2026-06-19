import { useRef, useState } from 'react'
import { useFocusTrap } from '../hooks/useFocusTrap'

export default function FocusTrapTestPage() {
  const [isActive, setIsActive] = useState(false)
  const [returnFocusOnDeactivate, setReturnFocusOnDeactivate] = useState(true)
  const [logs, setLogs] = useState<string[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const initialFocusRef = useRef<HTMLButtonElement>(null)
  const returnFocusRef = useRef<HTMLButtonElement>(null)
  const externalBeforeRef = useRef<HTMLButtonElement>(null)

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`])
  }

  const handleEscape = () => {
    addLog('Escape key pressed - deactivating trap')
    setIsActive(false)
  }

  useFocusTrap({
    containerRef,
    isActive,
    initialFocusRef,
    returnFocusRef,
    onEscape: handleEscape,
    returnFocusOnDeactivate,
  })

  const handleActivate = () => {
    addLog('Activating focus trap')
    setIsActive(true)
  }

  const handleDeactivate = () => {
    addLog('Deactivating focus trap')
    setIsActive(false)
  }

  const handleExternalBeforeFocus = () => {
    addLog('Focused: External Button Before')
  }

  const handleExternalAfterFocus = () => {
    addLog('Focused: External Button After')
  }

  const handleTrapElementFocus = (elementId: string) => {
    addLog(`Focused: ${elementId}`)
  }

  const clearLogs = () => {
    setLogs([])
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
      <h1>useFocusTrap Test Page</h1>
      
      <section style={{ marginBottom: '2rem', border: '1px solid #ccc', padding: '1.5rem', borderRadius: '8px' }}>
        <h2>Test Controls</h2>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <button onClick={handleActivate}>Activate Focus Trap</button>
          <button onClick={handleDeactivate}>Deactivate Focus Trap</button>
          <button onClick={() => setReturnFocusOnDeactivate(!returnFocusOnDeactivate)}>
            Toggle Return Focus: {returnFocusOnDeactivate ? 'ON' : 'OFF'}
          </button>
          <button onClick={clearLogs}>Clear Log</button>
        </div>
        <div style={{ 
          padding: '0.5rem', 
          borderRadius: '4px', 
          margin: '0.5rem 0', 
          fontWeight: 'bold',
          background: isActive ? '#d4edda' : '#f8d7da',
          color: isActive ? '#155724' : '#721c24'
        }}>
          Status: {isActive ? 'Active' : 'Inactive'}
        </div>
      </section>

      <section style={{ marginBottom: '2rem', border: '1px solid #ccc', padding: '1.5rem', borderRadius: '8px' }}>
        <h2>External Button (Before Trap)</h2>
        <button 
          ref={externalBeforeRef}
          onFocus={handleExternalBeforeFocus}
          style={{ margin: '1rem 0' }}
        >
          External Button Before
        </button>
      </section>

      <section style={{ marginBottom: '2rem', border: '1px solid #ccc', padding: '1.5rem', borderRadius: '8px' }}>
        <h2>Focus Trap Container</h2>
        <div 
          ref={containerRef}
          style={{
            border: `2px solid ${isActive ? '#28a745' : '#007bff'}`,
            padding: '1.5rem',
            borderRadius: '8px',
            background: isActive ? '#d4edda' : '#f8f9fa'
          }}
        >
          <h3>Inside Focus Trap</h3>
          <button 
            ref={initialFocusRef}
            onFocus={() => handleTrapElementFocus('Button 1')}
            style={{ margin: '0.5rem' }}
          >
            Button 1
          </button>
          <button 
            onFocus={() => handleTrapElementFocus('Button 2')}
            style={{ margin: '0.5rem' }}
          >
            Button 2
          </button>
          <input 
            type="text" 
            placeholder="Input 1"
            onFocus={() => handleTrapElementFocus('Input 1')}
            style={{ margin: '0.5rem', padding: '0.5rem' }}
          />
          <button 
            onFocus={() => handleTrapElementFocus('Button 3')}
            style={{ margin: '0.5rem' }}
          >
            Button 3
          </button>
          <a 
            href="#"
            onClick={(e) => e.preventDefault()}
            onFocus={() => handleTrapElementFocus('Link 1')}
            style={{ margin: '0.5rem' }}
          >
            Link 1
          </a>
          <input 
            type="text" 
            placeholder="Input 2"
            onFocus={() => handleTrapElementFocus('Input 2')}
            style={{ margin: '0.5rem', padding: '0.5rem' }}
          />
          <button 
            onFocus={() => handleTrapElementFocus('Button 4')}
            style={{ margin: '0.5rem' }}
          >
            Button 4
          </button>
        </div>
      </section>

      <section style={{ marginBottom: '2rem', border: '1px solid #ccc', padding: '1.5rem', borderRadius: '8px' }}>
        <h2>External Button (After Trap)</h2>
        <button 
          ref={returnFocusRef}
          onFocus={handleExternalAfterFocus}
          style={{ margin: '1rem 0' }}
        >
          External Button After
        </button>
      </section>

      <section style={{ marginBottom: '2rem', border: '1px solid #ccc', padding: '1.5rem', borderRadius: '8px' }}>
        <h2>Event Log</h2>
        <div style={{ 
          background: '#f4f4f4', 
          padding: '1rem', 
          borderRadius: '4px', 
          maxHeight: '200px', 
          overflowY: 'auto',
          fontFamily: 'monospace',
          fontSize: '0.9rem'
        }}>
          {logs.length === 0 ? (
            <div style={{ color: '#666' }}>No logs yet. Activate the focus trap to begin testing.</div>
          ) : (
            logs.map((log, index) => (
              <div key={index} style={{ margin: '0.25rem 0', borderBottom: '1px solid #ddd' }}>
                {log}
              </div>
            ))
          )}
        </div>
      </section>

      <section style={{ marginBottom: '2rem', border: '1px solid #ccc', padding: '1.5rem', borderRadius: '8px' }}>
        <h2>Test Instructions</h2>
        
        <h3>Tab/Shift+Tab Cycling Test:</h3>
        <ol>
          <li>Click "Activate Focus Trap"</li>
          <li>Press <code>Tab</code> repeatedly - focus should cycle through trap elements only</li>
          <li>Press <code>Shift+Tab</code> repeatedly - focus should cycle backwards through trap elements only</li>
          <li>Focus should never leave the trap container while active</li>
        </ol>

        <h3>Escape Key Test:</h3>
        <ol>
          <li>Click "Activate Focus Trap"</li>
          <li>Focus any element inside the trap</li>
          <li>Press <code>Escape</code> - should deactivate trap and call onEscape callback</li>
          <li>Check log for "Escape key pressed" entry</li>
        </ol>

        <h3>Focus Restore on Deactivate Test:</h3>
        <ol>
          <li>Click "External Button Before" to focus it</li>
          <li>Click "Activate Focus Trap"</li>
          <li>Click "Deactivate Focus Trap"</li>
          <li>Focus should return to "External Button Before"</li>
          <li>Toggle "Return Focus" to OFF and repeat - focus should not return</li>
        </ol>

        <h3>Initial Focus Test:</h3>
        <ol>
          <li>Click "External Button Before" to focus it</li>
          <li>Click "Activate Focus Trap"</li>
          <li>Focus should move to first focusable element in trap (Button 1)</li>
        </ol>

        <h3>Custom Return Focus Test:</h3>
        <ol>
          <li>Click "External Button After" to focus it</li>
          <li>Click "Activate Focus Trap"</li>
          <li>Click "Deactivate Focus Trap"</li>
          <li>Focus should return to "External Button After" (set as returnFocusRef)</li>
        </ol>
      </section>
    </div>
  )
}
