import { useEffect, useMemo, useRef, useState } from 'react'
import {
  VIRTUALIZED_LIST_DEFAULT_ITEM_HEIGHT,
  VIRTUALIZED_LIST_DEFAULT_OVERSCAN,
  VIRTUALIZED_LIST_DEFAULT_THRESHOLD,
} from '../config/virtualizedList'

export interface VirtualizedListProps<T> {
  items: T[]
  itemHeight?: number
  overscan?: number
  getKey: (item: T, index: number) => string | number
  renderItem: (item: T, index: number) => React.ReactNode
  className?: string
  containerClassName?: string
  style?: React.CSSProperties
  containerStyle?: React.CSSProperties
  emptyMessage?: React.ReactNode
  height?: number
  virtualizeThreshold?: number
}

export default function VirtualizedList<T>({
  items,
  itemHeight = VIRTUALIZED_LIST_DEFAULT_ITEM_HEIGHT,
  overscan = VIRTUALIZED_LIST_DEFAULT_OVERSCAN,
  getKey,
  renderItem,
  className,
  containerClassName,
  style,
  containerStyle,
  emptyMessage,
  height = 320,
  virtualizeThreshold = VIRTUALIZED_LIST_DEFAULT_THRESHOLD,
}: VirtualizedListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setScrollTop(0)
  }, [items.length])

  const shouldVirtualize = items.length >= virtualizeThreshold
  const visibleCount = Math.max(1, Math.ceil(height / itemHeight) + 1)
  const totalHeight = items.length * itemHeight
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
  const endIndex = Math.min(items.length, startIndex + visibleCount + overscan * 2)

  const visibleItems = useMemo(() => {
    const rangeStart = shouldVirtualize ? startIndex : 0
    const rangeEnd = shouldVirtualize ? endIndex : items.length
    return items.slice(rangeStart, rangeEnd).map((item, relativeIndex) => ({
      item,
      index: rangeStart + relativeIndex,
    }))
  }, [items, shouldVirtualize, startIndex, endIndex])

  const offsetY = shouldVirtualize ? startIndex * itemHeight : 0

  if (items.length === 0) {
    return emptyMessage ? <div className={className}>{emptyMessage}</div> : null
  }

  return (
    <div
      ref={containerRef}
      className={containerClassName}
      style={{
        height,
        overflowY: 'auto',
        position: 'relative',
        ...containerStyle,
      }}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
    >
      <div style={{ height: shouldVirtualize ? totalHeight : 'auto', position: 'relative' }}>
        <div
          style={{ transform: shouldVirtualize ? `translateY(${offsetY}px)` : undefined }}
          className={className}
        >
          {visibleItems.map(({ item, index }) => (
            <div key={getKey(item, index)} style={{ height: itemHeight }}>
              {renderItem(item, index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
