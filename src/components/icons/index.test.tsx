import { Suspense } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CopyIcon, WalletIcon } from './index'

describe('lazy icon exports', () => {
  it('loads an icon implementation on demand', async () => {
    render(
      <Suspense fallback={<span>loading icon</span>}>
        <CopyIcon aria-label="Copy" />
      </Suspense>
    )

    expect(await screen.findByLabelText('Copy')).toBeInTheDocument()
  })

  it('keeps each icon independently loadable', async () => {
    render(
      <Suspense fallback={null}>
        <WalletIcon aria-label="Wallet" />
      </Suspense>
    )

    expect(await screen.findByLabelText('Wallet')).toBeInTheDocument()
  })
})
