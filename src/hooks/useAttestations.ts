import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { apiFetch, type ApiError } from '../api/client'
import type { ApiResponse, Attestation, AttestationType, operations } from '../api/types'
import { useWallet } from '../context/WalletContext'
import { useSettings } from '../context/SettingsContext'
import {
  ATTESTATION_EVENTS,
  ATTESTATION_STATUSES,
  statusToTone,
  type ActivityItem,
  type AttestationPayload,
} from '../events'
import { runIdempotentOperation } from '../lib/idempotentOperation'
import { truncateAddress } from '../lib/stellar'
import { invalidateApiQuery, useApiQuery } from './useApiQuery'
import { useApiMutation } from './useApiMutation'

const PAGE_SIZE = 100
const ATTESTATIONS_PATH = `/attestations?limit=${PAGE_SIZE}`

type AttestationsListResponse = ApiResponse<operations['listAttestations']>

export interface SubmitAttestationOptions {
  idempotencyKey?: string
}

interface SubmitAttestationVariables {
  payload: AttestationPayload
  idempotencyKey: string
}

interface SubmitAttestationContext {
  previousItems: ActivityItem[]
  optimisticId: string
}

export interface UseAttestationsResult {
  items: ActivityItem[]
  isLoading: boolean
  error: ApiError | null
  isSubmitting: boolean
  submitError: Error | null
  refetch: () => Promise<void>
  submitAttestation: (
    payload: AttestationPayload,
    options?: SubmitAttestationOptions
  ) => Promise<Attestation>
}

export function createAttestationIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `att-${crypto.randomUUID()}`
  }
  return `att-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function useAttestations(): UseAttestationsResult {
  const { t } = useTranslation()
  const { address, isConnected, network: walletNetwork } = useWallet()
  const { network: settingsNetwork } = useSettings()
  const network = walletNetwork || settingsNetwork
  const identityKey = `${network}:${address || 'anonymous'}`

  const query = useApiQuery<AttestationsListResponse>(ATTESTATIONS_PATH, {
    enabled: true,
    identityKey,
  })

  const mapTitle = useCallback(
    (type: string): string => {
      if (type === ATTESTATION_EVENTS.TYPES.IDENTITY) {
        return t('activityTimeline.identityAttestation')
      }
      if (type === ATTESTATION_EVENTS.TYPES.PEER_VOUCH) {
        return t('activityTimeline.peerVouch')
      }
      return t('activityTimeline.credentialCertification')
    },
    [t]
  )

  const mapStatusLabel = useCallback(
    (status: Attestation['status']): string => {
      if (status === ATTESTATION_STATUSES.ACCEPTED) {
        return t('attestations.status.accepted', 'Accepted')
      }
      if (status === ATTESTATION_STATUSES.NEEDS_UPDATE) {
        return t('attestations.status.needsUpdate', 'Needs update')
      }
      return t('attestations.status.inReview', 'In review')
    },
    [t]
  )

  const attestationToActivityItem = useCallback(
    (attestation: Attestation): ActivityItem => ({
      id: attestation.id,
      timestamp: attestation.createdAt,
      title: mapTitle(attestation.type),
      description: attestation.evidence,
      actor: attestation.actor,
      statusLabel: mapStatusLabel(attestation.status),
      tone: statusToTone(attestation.status),
      meta:
        attestation.meta ??
        t('activityTimeline.subject', { subject: attestation.subject.substring(0, 8) }),
      status: attestation.status,
    }),
    [mapStatusLabel, mapTitle, t]
  )

  const serverItems = useMemo(
    () => (query.data?.items ?? []).map(attestationToActivityItem),
    [query.data, attestationToActivityItem]
  )

  const [items, setItems] = useState<ActivityItem[]>(serverItems)
  const itemsRef = useRef<ActivityItem[]>(items)
  itemsRef.current = items

  useEffect(() => {
    setItems(serverItems)
  }, [serverItems])

  const mutation = useApiMutation<
    Attestation,
    SubmitAttestationVariables,
    SubmitAttestationContext
  >({
    mutationFn: async ({ payload, idempotencyKey }) => {
      const body = {
        subject: payload.subject,
        type: payload.type as AttestationType,
        evidence: payload.evidence,
      }

      return runIdempotentOperation<Attestation>({
        namespace: 'attestations:submit',
        requestKey: idempotencyKey,
        fingerprint: JSON.stringify(body),
        execute: () =>
          apiFetch<Attestation>('/attestations', {
            method: 'POST',
            body,
            idempotencyKey,
          }),
      })
    },
    onMutate: ({ payload, idempotencyKey }) => {
      const previousItems = itemsRef.current
      const optimisticId = `optimistic-${idempotencyKey}`
      const actor =
        isConnected && address ? truncateAddress(address) : t('activityTimeline.currentUser')

      const optimisticItem: ActivityItem = {
        id: optimisticId,
        timestamp: new Date().toISOString(),
        title: mapTitle(payload.type),
        description: payload.evidence,
        actor,
        statusLabel: t('activityTimeline.submitted'),
        tone: 'success',
        meta: t('activityTimeline.subject', { subject: payload.subject.substring(0, 8) }),
        status: ATTESTATION_STATUSES.ACCEPTED,
      }

      setItems((prev) => [optimisticItem, ...prev])
      return { previousItems, optimisticId }
    },
    onSuccess: (created, _variables, context) => {
      const committedItem = attestationToActivityItem(created)
      setItems((prev) => {
        if (!context) return [committedItem, ...prev]
        const exists = prev.some((item) => item.id === context.optimisticId)
        if (!exists) return [committedItem, ...prev]
        return prev.map((item) => (item.id === context.optimisticId ? committedItem : item))
      })
      invalidateApiQuery(ATTESTATIONS_PATH, identityKey)
    },
    onError: (_error, _variables, context) => {
      if (context) {
        setItems(context.previousItems)
      }
    },
  })

  const submitAttestation = useCallback(
    async (
      payload: AttestationPayload,
      options?: SubmitAttestationOptions
    ): Promise<Attestation> => {
      const idempotencyKey = options?.idempotencyKey ?? createAttestationIdempotencyKey()
      return mutation.mutateAsync({ payload, idempotencyKey })
    },
    [mutation]
  )

  return {
    items,
    isLoading: query.isLoading,
    error: query.error,
    isSubmitting: mutation.isPending,
    submitError: mutation.error,
    refetch: query.refetch,
    submitAttestation,
  }
}
