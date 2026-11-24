/**
 * @file stellar.ts
 * @description Shared Stellar address utilities for the Credence UI.
 *
 * This is the single source of truth for Stellar address validation
 * and formatting across all components.
 */

import { getUsdcIssuer, loadAccount } from './horizon'
import { getNetworkPassphrase, type CredenceNetwork } from './networkLabels'
import { parseAmount } from '../api/amount'

const STROOPS_PER_USDC = 10_000_000n
const USDC_SCALE = 2
const BASE_FEE = '100'
const TRANSACTION_TIMEOUT_SECONDS = 300

const BOND_CONTRACT_IDS: Record<CredenceNetwork, string | undefined> = {
  public: import.meta.env.VITE_BOND_CONTRACT_ID_PUBLIC,
  test: import.meta.env.VITE_BOND_CONTRACT_ID_TEST,
}

const SOROBAN_RPC_URLS: Record<CredenceNetwork, string | undefined> = {
  public: import.meta.env.VITE_SOROBAN_RPC_URL_PUBLIC,
  test: import.meta.env.VITE_SOROBAN_RPC_URL_TEST,
}

function getBondContractId(network: CredenceNetwork): string {
  const contractId = BOND_CONTRACT_IDS[network]?.trim()
  if (!contractId) {
    throw new Error(`The bond contract is not configured for the ${network} network.`)
  }
  return contractId
}

function getSorobanRpcUrl(network: CredenceNetwork): string {
  const rpcUrl = SOROBAN_RPC_URLS[network]?.trim()
  if (!rpcUrl) {
    throw new Error(`The Soroban RPC endpoint is not configured for the ${network} network.`)
  }
  return rpcUrl
}

function toContractAmount(amountUsdc: number): bigint {
  const canonicalAmount = parseAmount(amountUsdc, { scale: USDC_SCALE })
  const cents = BigInt(canonicalAmount.replace('.', ''))
  const amount = (cents * STROOPS_PER_USDC) / 100n

  if (amount <= 0n || amount > 9_223_372_036_854_775_807n) {
    throw new Error('Bond amount is outside the supported on-chain range.')
  }

  return amount
}

async function loadSorobanSdk() {
  return import('@stellar/stellar-sdk')
}

function getRecordField(value: unknown, fieldName: string): unknown {
  if (value instanceof Map) {
    for (const [key, entry] of value.entries()) {
      if (String(key) === fieldName) return entry
    }
    return undefined
  }

  if (typeof value === 'object' && value !== null) {
    return (value as Record<string, unknown>)[fieldName]
  }

  return undefined
}

function toBigIntAmount(value: unknown): bigint {
  if (typeof value === 'bigint') return value
  if (typeof value === 'number' && Number.isSafeInteger(value)) return BigInt(value)
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value)
  throw new Error('The bond contract returned an invalid available amount.')
}

/**
 * Builds a simulated, unsigned Soroban invocation for creating a bond.
 * The SDK is imported on demand to keep it out of the main application chunk.
 */
export async function buildCreateBondTransactionXdr(
  amountUsdc: number,
  durationDays: number,
  address: string,
  network: CredenceNetwork
): Promise<string> {
  const sdk = await loadSorobanSdk()
  const accountInfo = await loadAccount(address, network)
  const bondContractId = getBondContractId(network)
  const contract = new sdk.Contract(bondContractId)
  const account = new sdk.Account(address, accountInfo.sequence)
  const networkPassphrase = getNetworkPassphrase(network)
  const amount = toContractAmount(amountUsdc)

  const server = new sdk.rpc.Server(getSorobanRpcUrl(network), { allowHttp: false })
  const latestLedger = await server.getLatestLedger()
  const tokenContractId = new sdk.Asset('USDC', getUsdcIssuer(network)).contractId(networkPassphrase)

  const transaction = new sdk.TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(
      new sdk.Contract(tokenContractId).call(
        'approve',
        sdk.Address.fromString(address).toScVal(),
        sdk.Address.fromString(bondContractId).toScVal(),
        sdk.nativeToScVal(amount, { type: 'i128' }),
        sdk.nativeToScVal(latestLedger.sequence + 5_000, { type: 'u32' })
      )
    )
    .addOperation(
      contract.call(
        'create_bond',
        sdk.Address.fromString(address).toScVal(),
        sdk.nativeToScVal(amount, { type: 'i128' }),
        sdk.nativeToScVal(BigInt(durationDays) * 86_400n, { type: 'u64' }),
        sdk.nativeToScVal(false),
        sdk.nativeToScVal(0n, { type: 'u64' })
      )
    )
    .setTimeout(TRANSACTION_TIMEOUT_SECONDS)
    .build()

  const simulation = await server.simulateTransaction(transaction)
  if (sdk.rpc.Api.isSimulationError(simulation)) {
    throw new Error(`Soroban transaction simulation failed: ${simulation.error}`)
  }

  return sdk.rpc.assembleTransaction(transaction, simulation).build().toXDR()
}

/**
 * Builds a simulated, unsigned invocation to withdraw the full currently
 * available bond balance. The API bond ID is off-chain metadata; the contract
 * keys bond state by the connected identity.
 */
export async function buildWithdrawBondTransactionXdr(
  address: string,
  network: CredenceNetwork,
  expectedAmount?: number
): Promise<string> {
  const sdk = await loadSorobanSdk()
  const accountInfo = await loadAccount(address, network)
  const contract = new sdk.Contract(getBondContractId(network))
  const account = new sdk.Account(address, accountInfo.sequence)
  const server = new sdk.rpc.Server(getSorobanRpcUrl(network), { allowHttp: false })
  const networkPassphrase = getNetworkPassphrase(network)

  const readTransaction = new sdk.TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(
      contract.call('describe_bond', sdk.Address.fromString(address).toScVal())
    )
    .setTimeout(TRANSACTION_TIMEOUT_SECONDS)
    .build()

  const readSimulation = await server.simulateTransaction(readTransaction)
  if (sdk.rpc.Api.isSimulationError(readSimulation)) {
    throw new Error(`Unable to load bond state: ${readSimulation.error}`)
  }

  const returnValue = readSimulation.result?.retval
  if (!returnValue) {
    throw new Error('The bond contract did not return the current bond state.')
  }

  const bondState = sdk.scValToNative(returnValue)
  if (!bondState) {
    throw new Error('No on-chain bond was found for this wallet.')
  }

  const availableAmount = toBigIntAmount(getRecordField(bondState, 'available_amount'))
  if (availableAmount <= 0n) {
    throw new Error('This bond has no available balance to withdraw.')
  }

  if (expectedAmount !== undefined && toContractAmount(expectedAmount) !== availableAmount) {
    throw new Error('The bond balance has changed. Refresh the bond details and try again.')
  }

  const transaction = new sdk.TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(
      contract.call(
        'withdraw',
        sdk.Address.fromString(address).toScVal(),
        sdk.nativeToScVal(availableAmount, { type: 'i128' })
      )
    )
    .setTimeout(TRANSACTION_TIMEOUT_SECONDS)
    .build()

  const simulation = await server.simulateTransaction(transaction)
  if (sdk.rpc.Api.isSimulationError(simulation)) {
    throw new Error(`Soroban transaction simulation failed: ${simulation.error}`)
  }

  return sdk.rpc.assembleTransaction(transaction, simulation).build().toXDR()
}

/**
 * Validates Stellar public key format and CRC-16 checksum.
 *
 * Valid addresses: 56 characters, starts with 'G', contain only
 * uppercase letters A-Z and digits 0-9, and pass the StrKey CRC-16 XMODEM checksum.
 *
 * @example
 * isValidStellarAddress('GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H') // → true
 * isValidStellarAddress('invalid') // → false
 * isValidStellarAddress('') // → false
 * isValidStellarAddress(undefined) // → false
 */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function decodeBase32(input: string): Uint8Array | null {
  const cleaned = input.toUpperCase().replace(/=+$/, '')
  if (!/^[A-Z2-7]*$/.test(cleaned)) {
    return null
  }

  const length = cleaned.length
  const bytes = new Uint8Array(Math.floor((length * 5) / 8))
  let bits = 0
  let value = 0
  let index = 0

  for (let i = 0; i < length; i++) {
    const char = cleaned[i]
    const val = ALPHABET.indexOf(char)
    if (val === -1) return null

    value = (value << 5) | val
    bits += 5

    if (bits >= 8) {
      bytes[index++] = (value >>> (bits - 8)) & 255
      bits -= 8
      value &= (1 << bits) - 1
    }
  }

  return bytes
}

function calculateCRC16(data: Uint8Array): number {
  const polynomial = 0x1021
  let crc = 0x0000

  for (let i = 0; i < data.length; i++) {
    crc ^= data[i] << 8
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ polynomial : crc << 1
    }
  }
  return crc & 0xffff
}

function verifyChecksum(address: string): boolean {
  if (address.length !== 56 || address[0] !== 'G') {
    return false
  }
  const bytes = decodeBase32(address)
  if (!bytes || bytes.length !== 35) {
    return false
  }

  const payload = bytes.slice(0, 33)
  const checksumBytes = bytes.slice(33, 35)
  const calculatedChecksum = calculateCRC16(payload)

  const expectedChecksum = checksumBytes[0] | (checksumBytes[1] << 8)
  return calculatedChecksum === expectedChecksum
}

export function isValidStellarAddress(address: string | undefined | null): boolean {
  if (!address) return false
  // Stellar addresses are 56 characters and start with 'G', followed by 55 uppercase alphanumeric chars
  if (!/^G[A-Z0-9]{55}$/.test(address)) {
    return false
  }
  // Additionally verify the StrKey CRC-16 XMODEM checksum
  return verifyChecksum(address)
}

/**
 * Truncates address for display: shows first 12 and last 8 characters.
 *
 * Preserves short addresses unchanged. Returns empty string for empty input.
 * Handles undefined/null values gracefully. Trims whitespace.
 *
 * @example
 * truncateAddress('GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H')
 * // → "GBRPYHIL2CI3...X2H"
 * truncateAddress('GABC') // → "GABC"
 * truncateAddress('') // → ""
 * truncateAddress('   ') // → ""
 */
export function truncateAddress(address: string | undefined | null): string {
  if (!address) return ''
  const trimmed = address.trim()
  if (!trimmed) return ''
  if (trimmed.length <= 20) return trimmed
  return `${trimmed.substring(0, 12)}...${trimmed.substring(trimmed.length - 8)}`
}

/**
 * The set of display modes for a Stellar address.
 *
 * - `full`     — the complete 56-character key (e.g. for copy confirmations)
 * - `short`    — truncated form: first 12 + "..." + last 8 characters (default)
 * - `friendly` — very short label: first 6 + "…" + last 4 characters
 */
export type AddressDisplayMode = 'full' | 'short' | 'friendly'

/**
 * Formats a Stellar address for display according to the requested mode.
 *
 * Falls back to `short` for unknown / undefined modes. Returns an empty
 * string for empty / null / undefined input so callers don't need to guard.
 *
 * @example
 * const addr = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H'
 * formatAddressForDisplay(addr, 'full')     // → 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H'
 * formatAddressForDisplay(addr, 'short')    // → 'GBRPYHIL2CI3...X2H'     (first 12 + last 8)
 * formatAddressForDisplay(addr, 'friendly') // → 'GBRPYH…X2H' (first 6 + last 4, with '…')
 */
export function formatAddressForDisplay(
  address: string | undefined | null,
  mode: AddressDisplayMode | string | undefined
): string {
  if (!address) return ''
  const trimmed = address.trim()
  if (!trimmed) return ''

  switch (mode) {
    case 'full':
      return trimmed
    case 'friendly': {
      if (trimmed.length <= 10) return trimmed
      return `${trimmed.substring(0, 6)}\u2026${trimmed.substring(trimmed.length - 4)}`
    }
    case 'short':
    default:
      return truncateAddress(trimmed)
  }
}

export type AddressSanitizationError = {
  type: 'SUSPICIOUS_CHARACTERS'
  message: string
}

export type AddressSanitizationResult =
  | { ok: true; value: string }
  | { ok: false; error: AddressSanitizationError; fallbackValue: string }

/**
 * Sanitizes an input string intended to be a Stellar address.
 * Strips whitespace, common prefixes like 'stellar:', and detects suspicious characters.
 */
export function sanitizeAddressInput(input: string): AddressSanitizationResult {
  let sanitized = input.trim()

  if (sanitized.toLowerCase().startsWith('stellar:')) {
    sanitized = sanitized.slice(8)
  }

  // Detect non-ASCII printable characters (common in homograph/injection attacks)
  if (/[^\x20-\x7E]/.test(sanitized)) {
    return {
      ok: false,
      error: {
        type: 'SUSPICIOUS_CHARACTERS',
        message: 'Suspicious characters detected in address.',
      },
      fallbackValue: sanitized,
    }
  }

  return { ok: true, value: sanitized }
}
