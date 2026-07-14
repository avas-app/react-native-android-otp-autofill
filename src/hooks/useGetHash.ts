import { useCallback, useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'

import { AvasOtpAutofillModule } from '../module'

export interface UseGetHashOptions {
  onSuccess?: (value: string) => void
  onError?: (error: Error) => void
}

export interface UseGetHashReturn {
  hash: string | null
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/**
 * Fetches the app-signature hash used by the SMS Retriever API (Android only).
 *
 * @param options.onSuccess - Called when the hash is fetched. Does NOT need to be
 *   wrapped in useCallback — it's held in a ref.
 * @param options.onError - Called when the fetch fails. Does NOT need to be wrapped.
 * @returns The hash, loading state, error, and a stable refetch function.
 */
export const useGetHash = (
  options: UseGetHashOptions = {},
): UseGetHashReturn => {
  const [hash, setHash] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Held in refs so inline callbacks don't recreate fetchHash and re-trigger the
  // mount effect on every render (which would loop forever).
  const onSuccessRef = useRef(options.onSuccess)
  const onErrorRef = useRef(options.onError)
  useEffect(() => {
    onSuccessRef.current = options.onSuccess
    onErrorRef.current = options.onError
  }, [options.onSuccess, options.onError])

  const fetchHash = useCallback(async () => {
    // The app-signature hash is Android-only; no-op elsewhere so non-Android
    // callers get a clean "unsupported" signal instead of a spurious error.
    if (Platform.OS !== 'android') return

    try {
      setLoading(true)
      setError(null)

      const hashes = await AvasOtpAutofillModule.getHash()

      if (hashes && hashes.length > 0) {
        const appHash = hashes[0]
        setHash(appHash)
        onSuccessRef.current?.(appHash)
      } else {
        const noHashError = new Error('No app hash found')
        setError(noHashError)
        onErrorRef.current?.(noHashError)
      }
    } catch (err) {
      const fetchError =
        err instanceof Error ? err : new Error('Failed to get app hash')
      setError(fetchError)
      onErrorRef.current?.(fetchError)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHash()
  }, [fetchHash])

  return {
    hash,
    loading,
    error,
    refetch: fetchHash,
  }
}
