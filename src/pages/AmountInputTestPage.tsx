import { useState } from 'react'
import AmountInput from '../components/AmountInput'

export default function AmountInputTestPage() {
  const [value, setValue] = useState('')
  const [balance, setBalance] = useState(2500)
  const [customPresets, setCustomPresets] = useState<number[]>([100, 500, 1000])
  const [error, setError] = useState('')

  const handleValueChange = (newValue: string) => {
    setValue(newValue)
    const numValue = parseFloat(newValue) || 0
    setError(numValue > balance ? 'Amount exceeds balance' : '')
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1>AmountInput Test Page</h1>

      <section style={{ marginBottom: '2rem' }}>
        <h2>Basic Test (Default Presets)</h2>
        <p>Balance: {balance.toFixed(2)} USDC</p>
        <AmountInput value={value} onChange={handleValueChange} balance={balance} error={error} />
        <div style={{ marginTop: '1rem' }}>
          <strong>Current value:</strong> {value || '(empty)'}
        </div>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2>Custom Presets Test</h2>
        <p>Testing with custom presets: {customPresets.join(', ')}</p>
        <AmountInput
          value={value}
          onChange={handleValueChange}
          balance={balance}
          presets={customPresets}
          error={error}
        />
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2>Zero Balance Test (Max Disabled)</h2>
        <AmountInput value={value} onChange={handleValueChange} balance={0} error={error} />
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2>Small Balance Test (Some Presets Disabled)</h2>
        <AmountInput
          value={value}
          onChange={handleValueChange}
          balance={250}
          presets={[100, 500, 1000]}
          error={error}
        />
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2>Custom Currency Label</h2>
        <AmountInput
          value={value}
          onChange={handleValueChange}
          balance={balance}
          currencyLabel="USD"
          error={error}
        />
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2>Test Controls</h2>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button onClick={() => setBalance(2500)}>Set Balance: 2500</button>
          <button onClick={() => setBalance(100)}>Set Balance: 100</button>
          <button onClick={() => setBalance(0)}>Set Balance: 0</button>
          <button onClick={() => setBalance(10000)}>Set Balance: 10000</button>
          <button onClick={() => setValue('')}>Clear Value</button>
          <button onClick={() => setValue('1234.56')}>Set Value: 1234.56</button>
          <button onClick={() => setValue('0.01')}>Set Value: 0.01</button>
          <button onClick={() => setCustomPresets([50, 100, 200])}>Presets: [50, 100, 200]</button>
          <button onClick={() => setCustomPresets([1000, 5000, 10000])}>
            Presets: [1000, 5000, 10000]
          </button>
        </div>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2>Manual Input Test Cases</h2>
        <p>Try entering these values manually to test sanitization:</p>
        <ul>
          <li>
            <code>abc123</code> - should strip letters
          </li>
          <li>
            <code>$100.00</code> - should strip $
          </li>
          <li>
            <code>1,000.50</code> - should strip comma
          </li>
          <li>
            <code>12.345</code> - should truncate to 12.34
          </li>
          <li>
            <code>00123</code> - should remove leading zeros
          </li>
          <li>
            <code>-100</code> - should normalize to 0 on blur
          </li>
          <li>
            <code>0.5</code> - should format to 0.50 on blur
          </li>
        </ul>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2>Expected Behaviors</h2>
        <ul>
          <li>
            <strong>Sanitization:</strong> Invalid characters are stripped during input
          </li>
          <li>
            <strong>Formatting:</strong> Value shows with commas when not focused, raw when focused
          </li>
          <li>
            <strong>Normalization:</strong> On blur, value normalizes to 2 decimal places
          </li>
          <li>
            <strong>Max:</strong> Sets value to balance, disabled when balance ≤ 0
          </li>
          <li>
            <strong>Presets:</strong> Disabled when preset &gt; balance
          </li>
        </ul>
      </section>
    </div>
  )
}
