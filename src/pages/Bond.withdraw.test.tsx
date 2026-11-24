import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import Bond from './Bond';
import { ToastProvider } from '../components/Toast';
import { SettingsProvider } from '../context/SettingsContext';
import * as useBondMutationModule from '../hooks/useBondMutation';
import * as useWalletModule from '../hooks/useWallet';

// Mock the bond mutation hook
jest.mock('../hooks/useBondMutation', () => ({
  useBondMutation: jest.fn(),
}));

// Mock the wallet hook
jest.mock('../hooks/useWallet', () => ({
  useWallet: jest.fn(),
}));

const mockWithdrawBond = jest.fn();

function renderWithProviders(ui = <Bond />) {
  return render(
    <SettingsProvider>
      <ToastProvider>{ui}</ToastProvider>
    </SettingsProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockWithdrawBond.mockReset();
  (useBondMutationModule.useBondMutation as jest.Mock).mockReturnValue({
    withdrawBond: mockWithdrawBond,
  });
  (useWalletModule.useWallet as jest.Mock).mockReturnValue({
    connected: true,
    address: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ2345678901234567890',
    network: 'public',
  });
});

async function openWithdrawDialogForBond(bondIdLabel: string) {
  const card =
    screen.getByText(new RegExp(bondIdLabel, 'i')).closest('[data-testid="bond-card"]') ||
    screen.getByText(new RegExp(bondIdLabel, 'i')).closest('div');
  const btn = within(card!).getByRole('button', { name: /^withdraw$/i });
  fireEvent.click(btn);
  await screen.findByRole('dialog');
}

describe('Bond withdraw flow', () => {
  test('success: closes dialog, shows toast with mutation hash, returns focus', async () => {
    mockWithdrawBond.mockResolvedOnce({
      ok: true,
      data: { bondId: '1', transactionHash: 'abc123' },
    });

    renderWithProviders();

    await openWithdrawDialogForBond('1,000 USDC');

    const input = screen.getByLabelText(/confirm phrase/i);
    fireEvent.change(input, { target: { value: 'CONFIRM' } });

    const confirmBtn = screen.getByRole('button', { name: /withdraw bond/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    expect(mockWithdrawBond).toHaveBeenCalledTimes(1);
    expect(mockWithdrawBond).toHaveBeenCalledWith({ bondId: '1' });

    const link = await screen.findByRole('link', { name: /view on explorer/i });
    expect(link.getAttribute('href')).toMatch(/\/tx\/abc123$/);

    // Focus returns to the Withdraw button for bond 1
    const withdrawBtn = screen.getAllByRole('button', { name: /^withdraw$/i })[0];
    expect(document.activeElement).toBe(withdrawBtn);
  });

  test('rejection: keeps dialog open, shows error, re-enables buttons', async () => {
    mockWithdrawBond.mockResolvedOnce({
      ok: false,
      code: 'rejected',
      retryable: false,
    });

    renderWithProviders();

    await openWithdrawDialogForBond('1,000 USDC');

    const input = screen.getByLabelText(/confirm phrase/i);
    fireEvent.change(input, { target: { value: 'CONFIRM' } });

    const confirmBtn = screen.getByRole('button', { name: /withdraw bond/i });
    fireEvent.click(confirmBtn);

    await screen.findByText(/Request rejected in Freighter/i);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    const confirmAgain = screen.getByRole('button', { name: /withdraw bond/i });
    expect(confirmAgain).not.toBeDisabled();
    expect(screen.queryByText(/Bond withdrawn/i)).not.toBeInTheDocument();
  });

  test('network failure: retry calls withdrawBond again', async () => {
    mockWithdrawBond.mockResolvedOnce({
      ok: false,
      code: 'unknown',
      retryable: true,
    });
    mockWithdrawBond.mockResolvedOnce({
      ok: true,
      data: { bondId: '1', transactionHash: 'abc123' },
    });

    renderWithProviders();

    await openWithdrawDialogForBond('1,000 USDC');

    const input = screen.getByLabelText(/confirm phrase/i);
    fireEvent.change(input, { target: { value: 'CONFIRM' } });

    fireEvent.click(screen.getByRole('button', { name: /withdraw bond/i }));

    const retryBtn = await screen.findByRole('button', { name: /retry/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(mockWithdrawBond).toHaveBeenCalledTimes(2);
    });
  });

  test('double-click confirm only calls withdrawBond once', async () => {
    let resolve: (v: any) => void;
    const pending = new Promise((r) => {
      resolve = r;
    });
    mockWithdrawBond.mockReturnValue(pending);

    renderWithProviders();

    await openWithdrawDialogForBond('1,000 USDC');

    const input = screen.getByLabelText(/confirm phrase/i);
    fireEvent.change(input, { target: { value: 'CONFIRM' } });

    const confirmBtn = screen.getByRole('button', { name: /withdraw bond/i });
    fireEvent.click(confirmBtn);
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockWithdrawBond).toHaveBeenCalledTimes(1);
    });

    resolve!({ ok: true, data: { bondId: '1', transactionHash: 'abc123' } });
  });

  test('after success, opening another bond dialog has enabled buttons', async () => {
    mockWithdrawBond.mockResolvedOnce({
      ok: true,
      data: { bondId: '1', transactionHash: 'abc123' },
    });

    renderWithProviders();

    await openWithdrawDialogForBond('1,000 USDC');

    const input = screen.getByLabelText(/confirm phrase/i);
    fireEvent.change(input, { target: { value: 'CONFIRM' } });
    fireEvent.click(screen.getByRole('button', { name: /withdraw bond/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // Open dialog for another bond
    await openWithdrawDialogForBond('500 USDC');

    const cancelBtn = screen.getByRole('button', { name: /^cancel$/i });
    expect(cancelBtn).not.toBeDisabled();

    const confirmBtn = screen.getByRole('button', { name: /withdraw bond/i });
    expect(confirmBtn).not.toBeDisabled();
    // Not busy = not showing loading text
    expect(confirmBtn.textContent).toMatch(/withdraw bond/i);
  });

  test('toast never contains the hard-coded hash', async () => {
    mockWithdrawBond.mockResolvedOnce({
      ok: true,
      data: { bondId: '1', transactionHash: 'abc123' },
    });

    renderWithProviders();

    await openWithdrawDialogForBond('1,000 USDC');

    const input = screen.getByLabelText(/confirm phrase/i);
    fireEvent.change(input, { target: { value: 'CONFIRM' } });
    fireEvent.click(screen.getByRole('button', { name: /withdraw bond/i }));

    await screen.findByText(/Bond withdrawn/i);

    const toastContainer = screen.getByText(/Bond withdrawn/i).closest('[data-testid="toast"]') || document.body;
    expect(toastContainer.textContent).not.toContain('b2c3d4e5f6a1');
  });
});
