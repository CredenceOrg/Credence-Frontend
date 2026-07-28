import {
  ATTESTATION_STATUSES,
  statusToTone,
  type ActivityItem,
  type AttestationStatus,
} from '../events'

// Re-exported so consumers that used to import ActivityTone from this
// module keep resolving — see `src/components/ActivityTimeline.tsx`.
export type { ActivityTone } from '../events'
export type { ActivityItem } from '../events'

/** Default display label per status. Kept here rather than in the i18n
 *  namespace so the mock data renders something human-readable even
 *  before i18n provider resolution (e.g. raw Storybook previews). */
const LABEL_BY_STATUS: Record<AttestationStatus, string> = {
  [ATTESTATION_STATUSES.ACCEPTED]: 'Accepted',
  [ATTESTATION_STATUSES.NEEDS_UPDATE]: 'Needs update',
  [ATTESTATION_STATUSES.IN_REVIEW]: 'In review',
}

type MockItemInput = Omit<ActivityItem, 'tone' | 'statusLabel' | 'status'> & {
  status: AttestationStatus
  statusLabel?: string
}

/** Builds a fully-typed ActivityItem from a status + payload shape. The
 *  tone and human-readable statusLabel are derived from `status` so the
 *  sample data stays self-consistent. An explicit `statusLabel` on the
 *  input overrides the default for that status. */
function makeItem(input: MockItemInput): ActivityItem {
  const { status, statusLabel, ...rest } = input
  return {
    ...rest,
    tone: statusToTone(status),
    statusLabel: statusLabel ?? LABEL_BY_STATUS[status],
    status,
  }
}

export const SAMPLE_ACTIVITY: ActivityItem[] = [
  makeItem({
    id: 'evt-001',
    timestamp: 'Apr 28, 14:22 UTC',
    title: 'Attestation submitted',
    description:
      'Identity evidence package uploaded and signed for review. Proof matched the on-chain checksum.',
    actor: 'Validator Node 12',
    meta: 'Tx 0x93a1...22f4',
    status: ATTESTATION_STATUSES.ACCEPTED,
  }),
  makeItem({
    id: 'evt-002',
    timestamp: 'Apr 27, 09:48 UTC',
    title: 'Proof mismatch detected',
    description:
      'Signature payload differed from expected checksum for one field. Re-submit evidence with the corrected address.',
    actor: 'Automated Verifier',
    meta: 'Rule AV-17',
    status: ATTESTATION_STATUSES.NEEDS_UPDATE,
  }),
  makeItem({
    id: 'evt-003',
    timestamp: 'Apr 26, 20:11 UTC',
    title: 'Credential refreshed',
    description:
      'Expiration window extended after successful periodic check. Waiting on quorum review to finalize.',
    actor: 'System process',
    meta: 'Window +90d',
    status: ATTESTATION_STATUSES.IN_REVIEW,
  }),
  makeItem({
    id: 'evt-004',
    timestamp: 'Apr 25, 12:01 UTC',
    title: 'Bond-backed identity confirmed',
    description:
      'USDC bond locked against your wallet address. Validator quorum accepted the proof on the first round.',
    actor: 'Validator Node 04',
    meta: 'Tx 0xa37c...91de',
    status: ATTESTATION_STATUSES.ACCEPTED,
  }),
  makeItem({
    id: 'evt-005',
    timestamp: 'Apr 24, 16:33 UTC',
    title: 'Stale credential flagged',
    description:
      'Certification document is older than the 90-day threshold. Provide a renewed credential to clear this status.',
    actor: 'Automated Verifier',
    meta: 'Rule CR-04',
    status: ATTESTATION_STATUSES.NEEDS_UPDATE,
  }),
]

export const ACTIVITY_ITEMS: ActivityItem[] = SAMPLE_ACTIVITY
