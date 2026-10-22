import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import CreateBondFlow, { /* export ErrorBoundary if needed */ } from '../CreateBondFlow';

// Helper component that throws when rendered
function Bomb() {
  throw new Error('boom');
}

test('ErrorBoundary catches error and shows fallback UI', () => {
  const { container } = render(
    <CreateBondFlowErrorBoundary onReset={() => {}}>
      <Bomb />
    </CreateBondFlowErrorBoundary>
  );

  // Fallback UI should be visible
  expect(screen.getByText(/Unexpected error/i)).toBeInTheDocument();
  const retryBtn = screen.getByRole('button', { name: /Retry/i });
  expect(retryBtn).toBeInTheDocument();
  // Click retry should hide fallback UI
  fireEvent.click(retryBtn);
  expect(screen.queryByText(/Unexpected error/i)).not.toBeInTheDocument();
});
