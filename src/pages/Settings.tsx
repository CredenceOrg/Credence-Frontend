import { useSettings } from '../context/SettingsContext'
import ThemeToggle from '../components/ThemeToggle'
import { useToast } from '../components/ToastProvider'
import { FormField } from '../components/forms/FormField'
import Toggle from '../components/controls/Toggle'
import Select from '../components/controls/Select'
import './Settings.css'

export default function Settings() {
  const {
    themeMode,
    setThemeMode,
    network,
    setNetwork,
    addressDisplay,
    setAddressDisplay,
    toastsEnabled,
    setToastsEnabled,
    autoDismiss,
    setAutoDismiss,
    saveSettings,
    cancelSettings,
    hasUnsavedChanges,
  } = useSettings()
  const { addToast } = useToast()

  const handleSave = () => {
    saveSettings()
    addToast('success', 'Settings saved successfully')
  }

  const handleCancel = () => {
    cancelSettings()
    addToast('info', 'Settings reverted to last saved state')
    window.history.back()
  }

  return (
    <div className="settings-page">
      <h1 style={{ marginTop: 0 }}>Settings</h1>

      <section className="settings-section" aria-labelledby="appearance-heading">
        <h2 id="appearance-heading">Appearance</h2>
        <p className="form-hint">Controls for theme and visual preferences.</p>

        <FormField id="theme-seg" label="Theme">
          <div role="radiogroup" aria-label="Theme mode" style={{ display: 'flex', gap: '0.5rem' }}>
            <label>
              <input type="radio" name="theme" checked={themeMode === 'light'} onChange={() => setThemeMode('light')} />{' '}
              Light
            </label>
            <label>
              <input type="radio" name="theme" checked={themeMode === 'dark'} onChange={() => setThemeMode('dark')} />{' '}
              Dark
            </label>
            <label>
              <input type="radio" name="theme" checked={themeMode === 'system'} onChange={() => setThemeMode('system')} />{' '}
              System
            </label>
          </div>
        </FormField>

        <FormField id="theme-toggle" label="Quick toggle">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ThemeToggle />
            <span className="form-hint">Use the quick toggle to flip light/dark immediately.</span>
          </div>
        </FormField>
      </section>

      <section className="settings-section" aria-labelledby="network-heading">
        <h2 id="network-heading">Network</h2>
        <p className="form-hint">Choose the Stellar network to interact with.</p>

        <FormField id="network-select" label="Stellar Network">
          <Select value={network} onChange={setNetwork} options={[{ value: 'public', label: 'Public (Mainnet)' }, { value: 'test', label: 'Test (Testnet)' }]} />
        </FormField>
      </section>

      <section className="settings-section" aria-labelledby="display-heading">
        <h2 id="display-heading">Display</h2>
        <p className="form-hint">How addresses and identifiers are presented in the UI.</p>

        <fieldset style={{ border: 'none', padding: 0 }}>
          <legend className="sr-only">Address display format</legend>
          <FormField id="address-display" label="Address format">
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <label>
                <input type="radio" name="address" checked={addressDisplay === 'full'} onChange={() => setAddressDisplay('full')} />{' '}
                Full (G...)
              </label>
              <label>
                <input type="radio" name="address" checked={addressDisplay === 'short'} onChange={() => setAddressDisplay('short')} />{' '}
                Short (G...…)
              </label>
              <label>
                <input type="radio" name="address" checked={addressDisplay === 'friendly'} onChange={() => setAddressDisplay('friendly')} />{' '}
                Friendly (when available)
              </label>
            </div>
          </FormField>
        </fieldset>
      </section>

      <section className="settings-section" aria-labelledby="notifications-heading">
        <h2 id="notifications-heading">Notifications</h2>
        <p className="form-hint">Control toast and notification behavior.</p>

        <FormField id="toasts-enabled" label="Enable toasts">
          <Toggle checked={toastsEnabled} onChange={setToastsEnabled} ariaLabel="Enable toasts" />
        </FormField>

        <FormField id="auto-dismiss" label="Auto-dismiss duration">
          <Select
            value={autoDismiss}
            onChange={setAutoDismiss}
            options={[
              { value: 'off', label: 'Off (require manual dismiss)' },
              { value: '3s', label: '3 seconds' },
              { value: '5s', label: '5 seconds' },
              { value: '8s', label: '8 seconds' },
            ]}
          />
        </FormField>

        <FormField id="toast-preview" label="Preview">
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => addToast('info', 'This is a preview notification')}
              style={{ padding: '0.5rem 0.75rem' }}
              aria-label="Show preview toast"
            >
              Show preview
            </button>
            <span className="form-hint">Preview respects current toast settings.</span>
          </div>
        </FormField>
      </section>

      <div className="settings-actions">
        <button type="button" onClick={handleSave} style={{ padding: '0.5rem 0.75rem' }}>
          Save
        </button>
        <button type="button" onClick={handleCancel} style={{ padding: '0.5rem 0.75rem' }}>
          Cancel
        </button>
      </div>
    </div>
  )
}
