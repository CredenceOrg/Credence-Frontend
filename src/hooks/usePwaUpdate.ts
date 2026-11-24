import { useCallback, useEffect, useRef, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'
import { getGlobalMutationManagerInstance } from './useMutation'

export interface PwaUpdateState {
  needRefresh: boolean
  isUpdateDeferred: boolean
  updateError: string | null
  applyUpdate: () => Promise<void>
}

export function usePwaUpdate(): PwaUpdateState {
  const [needRefresh, setNeedRefresh] = useState(false)
  const [isUpdateDeferred, setIsUpdateDeferred] = useState(false)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const updateSWRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null)
  const deferredRef = useRef(false)

  const applyUpdate = useCallback(async () => {
    if (getGlobalMutationManagerInstance().hasPendingMutations()) {
      deferredRef.current = true
      setIsUpdateDeferred(true)
      return
    }

    deferredRef.current = false
    setIsUpdateDeferred(false)
    setUpdateError(null)
    try {
      await updateSWRef.current?.(true)
    } catch (error) {
      setUpdateError(error instanceof Error ? error.message : String(error))
    }
  }, [])

  useEffect(() => {
    updateSWRef.current = registerSW({
      immediate: true,
      onNeedRefresh: () => setNeedRefresh(true),
      onRegisterError: (error) => setUpdateError(error.message),
    })

    return () => {
      updateSWRef.current = null
    }
  }, [])

  useEffect(() => {
    const mutationManager = getGlobalMutationManagerInstance()
    return mutationManager.onEvent((event) => {
      if (event.type === 'started' || event.type === 'retrying') {
        return
      }

      queueMicrotask(() => {
        const hasPendingMutations = mutationManager.hasPendingMutations()

        if (!hasPendingMutations && deferredRef.current) {
          void applyUpdate()
        }
      })
    })
  }, [applyUpdate])

  return { needRefresh, isUpdateDeferred, updateError, applyUpdate }
}
