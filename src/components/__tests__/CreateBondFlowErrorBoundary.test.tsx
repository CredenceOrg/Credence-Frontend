import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { CreateBondFlowErrorBoundary } from '../CreateBondFlow'

test('ErrorBoundary catches error and shows fallback UI', () => {
  let shouldThrow = true
  function ConditionalBomb() {
    if (shouldThrow) {
      throw new Error('boom')
    }
    return <div>Recovered content</div>
  }

  render(
    <CreateBondFlowErrorBoundary
      onReset={() => {
        shouldThrow = false
      }}
    >
      <ConditionalBomb />
    </CreateBondFlowErrorBoundary>
  )

  // Fallback UI should be visible
  expect(screen.getByText(/Unexpected error/i)).toBeInTheDocument()
  const retryBtn = screen.getByRole('button', { name: /Retry/i })
  expect(retryBtn).toBeInTheDocument()
  // Click retry should hide fallback UI
  fireEvent.click(retryBtn)
  expect(screen.queryByText(/Unexpected error/i)).not.toBeInTheDocument()
  expect(screen.getByText('Recovered content')).toBeInTheDocument()
})
