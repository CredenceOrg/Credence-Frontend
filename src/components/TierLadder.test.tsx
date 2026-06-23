import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TierLadder from './TierLadder';

// Mock the child Badge component so its internal styling doesn't break our unit tests
vi.mock('./Badge', () => ({
  default: ({ variant }: { variant: string }) => <div data-testid={`badge-${variant}`}>{variant}</div>
}));

describe('TierLadder Component', () => {
  it('renders the visually hidden semantic heading for screen readers', () => {
    render(<TierLadder />);
    
    // Asserts compliance with <h2 id={headingId} className="sr-only">
    const heading = screen.getByRole('heading', { level: 2, name: /how trust is earned/i });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveClass('sr-only');
  });

  it('renders in a collapsed state by default', () => {
    render(<TierLadder />);

    const button = screen.getByRole('button', { name: /how trust is earned/i });
    expect(button).toHaveAttribute('aria-expanded', 'false');

    // Dynamically query based on whatever ID React's useId() outputted
    const panelId = button.getAttribute('aria-controls');
    expect(panelId).toBeTruthy();

    const panel = document.getElementById(panelId!);
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveAttribute('hidden');
    expect(panel).toHaveClass('tier-ladder__panel');
  });

  it('respects the defaultOpen prop to render expanded on mount', () => {
    render(<TierLadder defaultOpen={true} />);

    const button = screen.getByRole('button', { name: /how trust is earned/i });
    expect(button).toHaveAttribute('aria-expanded', 'true');

    const panelId = button.getAttribute('aria-controls');
    const panel = document.getElementById(panelId!);
    
    expect(panel).toBeInTheDocument();
    expect(panel).not.toHaveAttribute('hidden');
  });

  it('toggles aria-expanded and hidden panel attributes dynamically on user clicks', async () => {
    const user = userEvent.setup();
    render(<TierLadder />);

    const button = screen.getByRole('button', { name: /how trust is earned/i });
    const panelId = button.getAttribute('aria-controls');
    const panel = document.getElementById(panelId!);

    // --- First Click: Expand ---
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(panel).not.toHaveAttribute('hidden');

    // --- Second Click: Collapse ---
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(panel).toHaveAttribute('hidden');
  });

  it('renders all four tiers alongside their formatted threshold ranges', () => {
    render(<TierLadder defaultOpen={true} />);

    // Validate tier labels
    expect(screen.getByRole('heading', { level: 3, name: /bronze tier/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: /silver tier/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: /gold tier/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: /platinum tier/i })).toBeInTheDocument();

    // Validate formatThreshold outputs (using en-dash '–' or plus '+')
    expect(screen.getByText('0–249')).toBeInTheDocument();
    expect(screen.getByText('250–499')).toBeInTheDocument();
    expect(screen.getByText('500–749')).toBeInTheDocument();
    expect(screen.getByText('750+')).toBeInTheDocument();

    // Check that our mocked badges were rendered with correct variants
    expect(screen.getByTestId('badge-bronze')).toBeInTheDocument();
    expect(screen.getByTestId('badge-platinum')).toBeInTheDocument();
  });
});
