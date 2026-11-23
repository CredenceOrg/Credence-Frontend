import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchUsdcBalance, HorizonError } from './horizon'

const PUBLIC_ADDRESS = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA'
const TEST_ADDRESS = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'

const PUBLIC_USDC_ISSUER = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'
const TEST_USDC_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'

const mockFetch = vi.fn<typeof fetch>()

function horizonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('HorizonError', () => {
  it('sets its name, status, and message', () => {
    const error = new HorizonError(503, 'Service unavailable')

    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('HorizonError')
    expect(error.status).toBe(503)
    expect(error.message).toBe('Service unavailable')
  })
})

describe('fetchUsdcBalance', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each([
    {
      network: 'public' as const,
      address: PUBLIC_ADDRESS,
      url: `https://horizon.stellar.org/accounts/${PUBLIC_ADDRESS}`,
      issuer: PUBLIC_USDC_ISSUER,
    },
    {
      network: 'test' as const,
      address: TEST_ADDRESS,
      url: `https://horizon-testnet.stellar.org/accounts/${TEST_ADDRESS}`,
      issuer: TEST_USDC_ISSUER,
    },
  ])(
    'uses the $network Horizon URL and parses its USDC balance',
    async ({ network, address, url, issuer }) => {
      mockFetch.mockResolvedValueOnce(
        horizonResponse(200, {
          balances: [
            {
              asset_type: 'credit_alphanum4',
              asset_code: 'USDC',
              asset_issuer: issuer,
              balance: '12.3456000',
            },
          ],
        })
      )

      await expect(fetchUsdcBalance(address, network)).resolves.toBe(12.3456)
      expect(mockFetch).toHaveBeenCalledWith(url, { signal: undefined })
    }
  )

  it('encodes the account address and passes the abort signal', async () => {
    const address = `${PUBLIC_ADDRESS}/account`
    const signal = new AbortController().signal
    mockFetch.mockResolvedValueOnce(
      horizonResponse(200, {
        balances: [
          {
            asset_type: 'credit_alphanum4',
            asset_code: 'USDC',
            asset_issuer: PUBLIC_USDC_ISSUER,
            balance: '5',
          },
        ],
      })
    )

    await expect(fetchUsdcBalance(address, 'public', signal)).resolves.toBe(5)
    expect(mockFetch).toHaveBeenCalledWith(
      `https://horizon.stellar.org/accounts/${encodeURIComponent(address)}`,
      { signal }
    )
  })

  it('ignores native balances and USDC from the wrong issuer', async () => {
    mockFetch.mockResolvedValueOnce(
      horizonResponse(200, {
        balances: [
          { asset_type: 'native', balance: '100' },
          {
            asset_type: 'credit_alphanum4',
            asset_code: 'USDC',
            asset_issuer: 'GWRONGISSUER',
            balance: '25',
          },
        ],
      })
    )

    await expect(fetchUsdcBalance(PUBLIC_ADDRESS, 'public')).resolves.toBe(0)
  })

  it('returns zero when the account has no USDC trustline', async () => {
    mockFetch.mockResolvedValueOnce(
      horizonResponse(200, {
        balances: [{ asset_type: 'credit_alphanum4', asset_code: 'EURC', balance: '8' }],
      })
    )

    await expect(fetchUsdcBalance(PUBLIC_ADDRESS, 'public')).resolves.toBe(0)
  })

  it('returns zero for an account that Horizon cannot find', async () => {
    mockFetch.mockResolvedValueOnce(horizonResponse(404, { title: 'Not Found' }))

    await expect(fetchUsdcBalance(PUBLIC_ADDRESS, 'public')).resolves.toBe(0)
  })

  it.each([429, 500, 503])('throws HorizonError for HTTP %s', async (status) => {
    mockFetch.mockResolvedValueOnce(horizonResponse(status, { title: 'Failure' }))

    const request = fetchUsdcBalance(PUBLIC_ADDRESS, 'public')

    await expect(request).rejects.toBeInstanceOf(HorizonError)
    await expect(request).rejects.toMatchObject({
      name: 'HorizonError',
      status,
      message: `Horizon request failed (${status})`,
    })
  })

  it('returns zero without fetching during SSR', async () => {
    vi.stubGlobal('window', undefined)

    await expect(fetchUsdcBalance(PUBLIC_ADDRESS, 'public')).resolves.toBe(0)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
