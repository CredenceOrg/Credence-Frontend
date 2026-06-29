import type { ReactNode } from 'react'
import styles from './ActionCard.module.css'

interface ActionCardProps {
  title: string
  children: ReactNode
}

export default function ActionCard({ title, children }: ActionCardProps) {
  return (
    <article className={styles.card}>
      <h2 className={styles.title}>{title}</h2>
      <div className={styles.content}>{children}</div>
    </article>
  )
}
