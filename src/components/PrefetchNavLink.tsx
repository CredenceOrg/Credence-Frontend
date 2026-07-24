import { NavLink, NavLinkProps } from 'react-router-dom'
import { useRoutePrefetch } from '../hooks/useRoutePrefetch'

interface PrefetchNavLinkProps extends NavLinkProps {
  preload: () => Promise<unknown>
}

export function PrefetchNavLink({ preload, ...props }: PrefetchNavLinkProps) {
  const handlers = useRoutePrefetch(preload)
  const { onMouseEnter: originalMouseEnter, onFocus: originalFocus, onTouchStart: originalTouchStart } = props

  return (
    <NavLink
      {...props}
      onMouseEnter={(e) => {
        handlers.onMouseEnter()
        originalMouseEnter?.(e)
      }}
      onFocus={(e) => {
        handlers.onFocus()
        originalFocus?.(e)
      }}
      onTouchStart={(e) => {
        handlers.onTouchStart()
        originalTouchStart?.(e)
      }}
    />
  )
}
