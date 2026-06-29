export type ActivityTone = 'success' | 'warning' | 'info'

export interface ActivityItem {
  id: string
  timestamp: string
  title: string
  description: string
  actor: string
  statusLabel: string
  tone: ActivityTone
  meta: string
}

export const SAMPLE_ACTIVITY: ActivityItem[] = [
  {
    id: 'evt-001',
    timestamp: 'Apr 28, 14:22 UTC',
    title: 'Attestation submitted',
    description: 'Identity evidence package uploaded and signed for review.',
    actor: 'Validator Node 12',
    statusLabel: 'Accepted',
    tone: 'success',
    meta: 'Tx 0x93a1...22f4',
  },
  {
    id: 'evt-002',
    timestamp: 'Apr 27, 09:48 UTC',
    title: 'Proof mismatch detected',
    description: 'Signature payload differed from expected checksum for one field.',
    actor: 'Automated Verifier',
    statusLabel: 'Needs update',
    tone: 'warning',
    meta: 'Rule AV-17',
  },
  {
    id: 'evt-003',
    timestamp: 'Apr 26, 20:11 UTC',
    title: 'Credential refreshed',
    description: 'Expiration window extended after successful periodic check.',
    actor: 'System process',
    statusLabel: 'In review',
    tone: 'info',
    meta: 'Window +90d',
  },
]

export const ACTIVITY_ITEMS: ActivityItem[] = SAMPLE_ACTIVITY
