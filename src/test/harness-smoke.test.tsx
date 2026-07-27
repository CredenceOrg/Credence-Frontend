import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

function SmokeFixture() {
  return (
    <main>
      <h1>Credence test harness</h1>
    </main>
  )
}

describe('test harness', () => {
  it('renders React content with jest-dom matchers', () => {
    render(<SmokeFixture />)

    expect(screen.getByRole('heading', { name: /credence test harness/i })).toBeInTheDocument()
  })
})
