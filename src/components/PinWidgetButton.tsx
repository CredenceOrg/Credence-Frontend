import './PinWidgetButton.css';
import type { FC } from 'react';

interface PinWidgetButtonProps {
  slug: string;
  isPinned: boolean;
  onToggle: (slug: string) => void;
}

export const PinWidgetButton: FC<PinWidgetButtonProps> = ({ slug, isPinned, onToggle }) => (
  <button
    type="button"
    aria-label={isPinned ? 'Unpin widget' : 'Pin widget'}
    aria-pressed={isPinned}
    onClick={() => onToggle(slug)}
    className="pin-widget-button"
  >
    {isPinned ? '📌' : '📍'}
  </button>
);