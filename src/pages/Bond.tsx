export default function Bond() {
  return (
    <div>
      <h1 style={{ marginBottom: '0.5rem' }}>Bond USDC</h1>
      <p id="bond-desc" style={{ color: '#64748b', marginBottom: '1.5rem' }}>
        Lock USDC into the Credence contract to build your economic reputation.
      </p>
      <div
        style={{
          maxWidth: '24rem',
          padding: '1.5rem',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          background: '#fff',
        }}
      >
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
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            fontSize: '1rem',
          }}
        />
        <button
          type="button"
          style={{
            marginTop: '1rem',
            width: '100%',
            padding: '0.75rem',
            background: '#0284c7',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Create bond
        </button>
      </div>
    </div>
  )
}
