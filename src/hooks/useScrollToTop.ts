import { useEffect, useState } from 'react'
import { DOM_EVENTS } from '../events'

export const BACK_TO_TOP_SCROLL_THRESHOLD = 800

export function useScrollToTop(): boolean {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > BACK_TO_TOP_SCROLL_THRESHOLD)
    }

    window.addEventListener(DOM_EVENTS.SCROLL, handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener(DOM_EVENTS.SCROLL, handleScroll)
  }, [])

  return visible
}
