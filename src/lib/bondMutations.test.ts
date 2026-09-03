import { describe, expect, it, vi } from 'vitest'
import { AmountError } from '../api/amount'
import { submitCreateBond, submitWithdrawBond } from './bondMutations'

describe('bond mutation amount boundary', () => {
  it.each([
    ['zero', 0, 'BELOW_MIN'],
    ['below minimum', '9.99', 'BELOW_MIN'],
    ['fractional overflow', '10.001', 'INVALID_SCALE'],
    ['int64-adjacent product overflow', '92233720368547758.08', 'OVERFLOW'],
    ['non-finite number', Infinity, 'NOT_FINITE'],
  ] as const)('rejects %s before dispatch', async (_name, amount, code) => {
    const timeout = vi.spyOn(globalThis, 'setTimeout')

    await expect(submitCreateBond({ amountUsdc: amount })).rejects.toMatchObject({
      name: 'AmountError',
      code,
    } satisfies Partial<AmountError>)
    expect(timeout).not.toHaveBeenCalled()
    timeout.mockRestore()
  })

  it('accepts the exact maximum product amount for valid denominations', async () => {
    await expect(
      submitWithdrawBond({ bondId: 1, amountUsdc: '1000000.00' })
    ).resolves.toMatchObject({
      hash: expect.stringMatching(/^local-bond-withdraw-/),
    })
  })
})
