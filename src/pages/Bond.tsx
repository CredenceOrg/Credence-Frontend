import Banner from '../components/Banner'
import { useToast } from '../components/ToastProvider'
import Badge from '../components/Badge'

export default function Bond() {
  const { addToast } = useToast()

  const handleCreate = () => {
    addToast('success', 'Bond created successfully.')
  }

  const mockBonds = [
    { id: 1, amount: '500 USDC', status: 'active' },
    { id: 2, amount: '1000 USDC', status: 'locked' },
    { id: 3, amount: '250 USDC', status: 'grace-period' },
  ]

  return (
    <div>
      <h1 style={{ marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Bond USDC</h1>
      <p id="bond-desc" style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
        Lock USDC into the Credence contract to build your economic reputation.
      </p>
      <Banner severity="info">
        Bonds are locked for a minimum of 30 days. Early withdrawal incurs a slash penalty.
      </Banner>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginTop: '2rem' }}>
        <div
          style={{
            padding: '1.5rem',
            border: '1px solid var(--border-default)',
            borderRadius: '12px',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
          }}
        >
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Create New Bond</h2>
          <label htmlFor="bond-amount" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            Amount (USDC)
          </label>
          <input
            id="bond-amount"
            type="number"
            placeholder="0"
            min="0"
            step="1"
            aria-describedby="bond-desc"
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid var(--border-default)',
              borderRadius: '8px',
              fontSize: '1rem',
              marginBottom: '1rem',
              background: 'var(--bg-page)',
              color: 'var(--text-primary)',
            }}
          />
          <button
            type="button"
            onClick={handleCreate}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: 'var(--color-primary)',
              color: 'var(--bg-page)',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Create bond
          </button>
        </div>

        <div
          style={{
            padding: '1.5rem',
            border: '1px solid var(--border-default)',
            borderRadius: '12px',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
          }}
        >
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Active Bonds</h2>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {mockBonds.map((bond) => (
              <li 
                key={bond.id} 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  padding: '0.75rem 0',
                  borderBottom: bond.id === mockBonds.length ? 'none' : '1px solid var(--border-default)'
                }}
              >
                <span style={{ fontWeight: 500 }}>{bond.amount}</span>
                <Badge variant={bond.status} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
