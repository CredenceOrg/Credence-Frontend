import type React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

declare const CreateBondFlowErrorBoundary: React.ComponentType<{
  onReset: () => void;
  children?: React.ReactNode;
}>;

// Helper component that throws when rendered
function Bomb(): JSX.Element {
  throw new Error('boom');
}

test('ErrorBoundary catches error and shows fallback UI', () => {
  render(
    <CreateBondFlowErrorBoundary onReset={() => {}}>
      <Bomb />
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
