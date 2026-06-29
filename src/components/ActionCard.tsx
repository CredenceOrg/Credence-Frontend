import type { ReactNode } from 'react'
import './ActionCard.css'

export interface ActionCardProps {
  title: string
  /**
   * The density of the card's padding.
   * @default 'comfortable'
   */
  padding?: 'compact' | 'comfortable'
  /**
   * Whether the card is elevated with a drop shadow and a hover transition.
   * @default false
   */
  elevated?: boolean
  children: ReactNode
}

export default function ActionCard({ title, padding = 'comfortable', elevated, children }: ActionCardProps) {
  const classes = ['actionCard', `actionCard--${padding}`]
  if (elevated) {
    classes.push('actionCard--elevated')
  }

  return (
    <article className={classes.join(' ')}>
      <h2 className="actionCard__title">
        {title}
      </h2>

      <div className="actionCard__content">{children}</div>
    </article>
  )
}
