import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import VirtualizedList from './VirtualizedList'

describe('VirtualizedList', () => {
  it('renders a window of items for long lists', () => {
    const items = Array.from({ length: 1500 }, (_, index) => `item-${index}`)

    render(
      <VirtualizedList
        items={items}
        itemHeight={40}
        height={120}
        virtualizeThreshold={1000}
        getKey={(item) => item}
        renderItem={(item) => <div>{item}</div>}
      />,
    )

    expect(screen.getByText('item-0')).toBeInTheDocument()
    expect(screen.getByText('item-8')).toBeInTheDocument()
    expect(screen.queryByText('item-9')).not.toBeInTheDocument()
  })
})
