import {
  ErrorEventPayload,
  SmsReceivedEventPayload,
  TimeoutEventPayload,
} from '../AvasOtpAutofill.types'
import { useCallback, useEffect, useRef, useState } from 'react'

import { AvasOtpAutofillModule } from '../otp-autofill'

export interface UseOtpListenerOptions {
  onOtpReceived?: (otp: string, message: string) => void
  onTimeout?: (message: string) => void
  onError?: (error: string, code: number) => void
}

export interface UseOtpListenerReturn {
  isListening: boolean
  loading: boolean
  receivedOtp: string | null
  receivedMessage: string | null
  error: string | null
  startListener: () => () => void
  stopListener: () => void
}

export const useOtpListener = (
  options: UseOtpListenerOptions = {},
): UseOtpListenerReturn => {
  const [isListening, setIsListening] = useState(false)
  const [loading, setLoading] = useState(false)
  const [receivedOtp, setReceivedOtp] = useState<string | null>(null)
  const [receivedMessage, setReceivedMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { onOtpReceived, onTimeout, onError } = options
  const unsubscribeRef = useRef<(() => void) | null>(null)

  const stopListener = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current()
      unsubscribeRef.current = null
    }
    setIsListening(false)
    setLoading(false)
  }, [])

  const startListener = useCallback(() => {
    if (isListening) {
      return () => {} // Return empty cleanup if already listening
    }

    try {
      setLoading(true)
      setError(null)
      setReceivedOtp(null)
      setReceivedMessage(null)

      // Set up event listeners
      const smsListener = AvasOtpAutofillModule.addListener(
        'onSmsReceived',
        (event: SmsReceivedEventPayload) => {
          stopListener()
          setReceivedOtp(event.otp)
          setReceivedMessage(event.message)
          onOtpReceived?.(event.otp || '', event.message)
        },
      )

      const timeoutListener = AvasOtpAutofillModule.addListener(
        'onTimeout',
        (event: TimeoutEventPayload) => {
          stopListener()
          setError('SMS verification timed out')
          onTimeout?.(event.message)
        },
      )

      const errorListener = AvasOtpAutofillModule.addListener(
        'onError',
        (event: ErrorEventPayload) => {
          stopListener()
          setError(event.message)
          setIsListening(false)
          onError?.(event.message, event.code)
        },
      )

      // Start the OTP listener (this may be async internally but we don't await)
      AvasOtpAutofillModule.startOtpListener().catch((err) => {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to start OTP listener'
        setError(errorMessage)
        onError?.(errorMessage, -1)
      })

      // Create cleanup function
      const cleanup = () => {
        smsListener?.remove()
        timeoutListener?.remove()
        errorListener?.remove()
      }

      unsubscribeRef.current = cleanup
      setIsListening(true)
      setLoading(false)

      return cleanup
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to start OTP listener'
      setError(errorMessage)
      setLoading(false)
      onError?.(errorMessage, -1)
      return () => {} // Return empty cleanup on error
    }
  }, [isListening, stopListener])

  useEffect(function cleanup() {
    return stopListener
  }, [stopListener])

  return {
    isListening,
    loading,
    receivedOtp,
    receivedMessage,
    error,
    startListener,
    stopListener,
  }
}
