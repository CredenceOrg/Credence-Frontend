import type { ReactNode } from 'react'
import './PageHeader.css'

export interface PageHeaderProps {
  /** One h1 per route: the primary page title. */
  title: string
  /** Supporting lead copy directly beneath the page title. */
  description: ReactNode
  /** Optional status badge or metadata chip aligned with the title row. */
  badge?: ReactNode
  /** Optional primary/secondary action area aligned with the title block. */
  action?: ReactNode
}

/**
 * Standard page-header pattern for top-level routes.
 *
 * Heading hierarchy rule:
 * - Route title: `h1`
 * - Card / section titles inside the route: `h2`
 * - Sub-sections nested within cards/sections: `h3`
 */
export default function PageHeader({
  title,
  description,
  badge,
  action,
}: PageHeaderProps) {
  return (
    <header className="pageHeader">
      <div className="pageHeader__main">
        <div className="pageHeader__titleRow">
          <h1 className="pageHeader__title">{title}</h1>
          {badge ? <div className="pageHeader__badge">{badge}</div> : null}
        </div>
        <p className="pageHeader__description">{description}</p>
      </div>
      {action ? <div className="pageHeader__action">{action}</div> : null}
    </header>
  )
}
