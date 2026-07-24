import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, test, expect, vi } from 'vitest';
import TrustSummary from '../pages/TrustSummary';

// Mock hooks and components used in TrustSummary
vi.mock('../hooks/useTrustScore', () => ({
  useTrustScore: vi.fn(() => ({
    data: { score: 500, tier: 'gold' },
    isLoading: false,
    error: null,
    refetch: vi.fn()
  }))
}));

vi.mock('../hooks/useCopyToClipboard', () => ({
  useCopyToClipboard: vi.fn(() => [vi.fn(), false])
}));

vi.mock('@/lib/stellar', () => ({
  isValidStellarAddress: vi.fn((addr) => !!addr)
}));

vi.mock('../components/Badge', () => ({
  default: (props: any) => <div data-testid="badge" {...props} />
}));

vi.mock('../components/TrustGauge', () => ({
  default: (props: any) => <div data-testid="gauge" {...props} />
}));

vi.mock('../components/TierLadder', () => ({
  default: () => <div data-testid="ladder" />
}));

vi.mock('../components/states', () => ({
  EmptyState: ({ title, message, description }: any) => (
    <div data-testid="empty">
      <h2>{title}</h2>
      <p>{description || message}</p>
    </div>
  ),
  ErrorState: (props: any) => <div data-testid="error" {...props} />, 
  LoadingSkeleton: (props: any) => <div data-testid="loading" {...props} />
}));

describe('TrustSummary component', () => {
  test('renders summary for valid address', () => {
    render(
      <MemoryRouter initialEntries={["/trust/summary?address=GABCD12345"]}>
        <Routes>
          <Route path="/trust/summary" element={<TrustSummary />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { name: /trust summary/i })).toBeInTheDocument();
    expect(screen.getByTestId('badge')).toBeInTheDocument();
    expect(screen.getByTestId('gauge')).toBeInTheDocument();
    expect(screen.getByTestId('ladder')).toBeInTheDocument();
  });

  test('shows empty state when address missing', () => {
    render(
      <MemoryRouter initialEntries={["/trust/summary"]}>
        <Routes>
          <Route path="/trust/summary" element={<TrustSummary />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByTestId('empty')).toBeInTheDocument();
    expect(screen.getByText(/no address supplied/i)).toBeInTheDocument();
  });

  test('Print button triggers window.print', () => {
    const printMock = vi.fn();
    // @ts-ignore
    window.print = printMock;
    render(
      <MemoryRouter initialEntries={["/trust/summary?address=GABCD12345"]}>
        <Routes>
          <Route path="/trust/summary" element={<TrustSummary />} />
        </Routes>
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: /print/i }));
    expect(printMock).toHaveBeenCalled();
  });
});
