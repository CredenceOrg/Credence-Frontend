import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TrustSummary from '../pages/TrustSummary';

// Mock hooks and components used in TrustSummary
jest.mock('../hooks/useTrustScore', () => ({
  useTrustScore: jest.fn(() => ({
    data: { score: 500, tier: 'gold' },
    isLoading: false,
    error: null,
    refetch: jest.fn()
  }))
}));

jest.mock('../hooks/useCopyToClipboard', () => ({
  useCopyToClipboard: jest.fn(() => [jest.fn(), false])
}));

jest.mock('../components/Badge', () => (props: any) => <div data-testid="badge" {...props} />);
jest.mock('../components/TrustGauge', () => (props: any) => <div data-testid="gauge" {...props} />);
jest.mock('../components/TierLadder', () => () => <div data-testid="ladder" />);
jest.mock('../components/states', () => ({
  EmptyState: (props: any) => <div data-testid="empty" {...props} />,
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
    const printMock = jest.fn();
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
