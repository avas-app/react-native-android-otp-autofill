import { useCallback, useEffect, useState } from 'react'

import { AvasOtpAutofillModule } from '../otp-autofill'

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

export const useGetHash = (
  options: UseGetHashOptions = {},
): UseGetHashReturn => {
  const [hash, setHash] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const { onSuccess, onError } = options

  const fetchHash = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const hashes = await AvasOtpAutofillModule.getHash()

      if (hashes && hashes.length > 0) {
        const appHash = hashes[0]
        setHash(appHash)
        onSuccess?.(appHash)
      } else {
        const errorMessage = new Error('No app hash found')
        setError(errorMessage)
        onError?.(errorMessage)
      }
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error('Failed to get app hash')
      setError(error)
      onError?.(error)
    } finally {
      setLoading(false)
    }
  }, [onError, onSuccess])

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
