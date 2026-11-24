import { useCallback, useEffect, useState } from 'react'
import { useWallet } from '../context/WalletContext'
import { useSettings } from '../context/SettingsContext'
import {
  ADDRESS_BOOK_MAX_ENTRIES,
  coerceAddressBookEntries,
  readAddressBook,
  validateAddressBookEntry,
  writeAddressBook,
  type AddressBookEntry,
} from '../lib/addressBookStorage'

export const ADDRESS_BOOK_UPDATED_EVENT = 'credence:address-book-updated'

export type AddressBookMutationResult =
  | { ok: true; entry: AddressBookEntry }
  | { ok: false; error: string }

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `ab_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

function notifyAddressBookUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ADDRESS_BOOK_UPDATED_EVENT))
  }
}

export function useAddressBook() {
  const { address: walletAddress } = useWallet()
  const { network } = useSettings()

  const [entries, setEntries] = useState<AddressBookEntry[]>(() =>
    readAddressBook(walletAddress, network)
  )

  // Reload whenever wallet or network scope changes
  useEffect(() => {
    setEntries(readAddressBook(walletAddress, network))
  }, [walletAddress, network])

  // Stay in sync with updates from other components in the same tab
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleSync = () => {
      setEntries(readAddressBook(walletAddress, network))
    }
    window.addEventListener(ADDRESS_BOOK_UPDATED_EVENT, handleSync)
    return () => window.removeEventListener(ADDRESS_BOOK_UPDATED_EVENT, handleSync)
  }, [walletAddress, network])

  const persist = useCallback(
    (next: AddressBookEntry[]) => {
      const sanitized = coerceAddressBookEntries(next)
      setEntries(sanitized)
      writeAddressBook(walletAddress, network, sanitized)
      notifyAddressBookUpdated()
      return sanitized
    },
    [walletAddress, network]
  )

  const addEntry = useCallback(
    (rawLabel: string, rawAddress: string): AddressBookMutationResult => {
      const current = readAddressBook(walletAddress, network)
      const validation = validateAddressBookEntry(rawLabel, rawAddress, current)
      if (!validation.ok) {
        return { ok: false, error: validation.error }
      }

      const now = new Date().toISOString()
      const entry: AddressBookEntry = {
        id: generateId(),
        label: validation.label,
        address: validation.address,
        createdAt: now,
        updatedAt: now,
      }
      persist([...current, entry])
      return { ok: true, entry }
    },
    [walletAddress, network, persist]
  )

  const updateEntry = useCallback(
    (id: string, rawLabel: string, rawAddress: string): AddressBookMutationResult => {
      const current = readAddressBook(walletAddress, network)
      const existing = current.find((e) => e.id === id)
      if (!existing) {
        return { ok: false, error: 'Address book entry not found.' }
      }

      const validation = validateAddressBookEntry(rawLabel, rawAddress, current, id)
      if (!validation.ok) {
        return { ok: false, error: validation.error }
      }

      const updated: AddressBookEntry = {
        ...existing,
        label: validation.label,
        address: validation.address,
        updatedAt: new Date().toISOString(),
      }
      persist(current.map((e) => (e.id === id ? updated : e)))
      return { ok: true, entry: updated }
    },
    [walletAddress, network, persist]
  )

  const removeEntry = useCallback(
    (id: string) => {
      const current = readAddressBook(walletAddress, network)
      persist(current.filter((e) => e.id !== id))
    },
    [walletAddress, network, persist]
  )

  const replaceEntries = useCallback(
    (next: AddressBookEntry[]) => {
      persist(next)
    },
    [persist]
  )

  return {
    entries,
    addEntry,
    updateEntry,
    removeEntry,
    replaceEntries,
    maxEntries: ADDRESS_BOOK_MAX_ENTRIES,
  }
}
