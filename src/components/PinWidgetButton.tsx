import './PinWidgetButton.css'
import type { FC } from 'react'

interface PinWidgetButtonProps {
  slug: string
  widgetTitle: string
  isPinned: boolean
  onToggle: (slug: string) => void
}

export const PinWidgetButton: FC<PinWidgetButtonProps> = ({
  slug,
  widgetTitle,
  isPinned,
  onToggle,
}) => (
  <button
    type="button"
    aria-label={`${isPinned ? 'Unpin' : 'Pin'} ${widgetTitle}`}
    aria-pressed={isPinned}
    onClick={() => onToggle(slug)}
    className="pin-widget-button"
  >
    {isPinned ? '📌' : '📍'}
  </button>
)
