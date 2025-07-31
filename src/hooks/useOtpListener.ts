import {
  ErrorEventPayload,
  SmsReceivedEventPayload,
  TimeoutEventPayload,
} from '../AvasOtpAutofill.types'
import { useCallback, useEffect, useRef, useState } from 'react'

import { AvasOtpAutofillModule } from '../module'

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
  startListener: () => Promise<void>
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

  const onOtpReceivedRef = useRef(options.onOtpReceived)
  const onTimeoutRef = useRef(options.onTimeout)
  const onErrorRef = useRef(options.onError)

  // Update refs when options change
  useEffect(() => {
    onOtpReceivedRef.current = options.onOtpReceived
    onTimeoutRef.current = options.onTimeout
    onErrorRef.current = options.onError
  }, [options.onOtpReceived, options.onTimeout, options.onError])

  const eventSubscriptions = useRef<{ remove: () => void }[]>([])

  const cleanup = useCallback(() => {
    // Remove all event subscriptions
    eventSubscriptions.current.forEach((subscription) => subscription.remove())
    eventSubscriptions.current = []

    // Stop the SMS retriever
    AvasOtpAutofillModule.stopSmsRetriever().catch((err) => {
      if (__DEV__) console.error('Failed to stop SMS retriever:', err)
    })

    setIsListening(false)
    setLoading(false)
  }, [])

  const stopListener = useCallback(() => {
    cleanup()
  }, [cleanup])

  const startListener = useCallback(async () => {
    if (isListening) {
      if (__DEV__) console.warn('SMS listener is already active')
      return
    }

    try {
      setLoading(true)
      setError(null)
      setReceivedOtp(null)
      setReceivedMessage(null)

      // Clean up any existing listeners
      cleanup()

      // Set up event listeners
      const smsListener = AvasOtpAutofillModule.addListener(
        'onSmsReceived',
        (event: SmsReceivedEventPayload) => {
          if (__DEV__) console.log('SMS received in hook:', event)
          setReceivedOtp(event.otp || null)
          setReceivedMessage(event.message)
          setIsListening(false)
          setLoading(false)
          onOtpReceivedRef.current?.(event.otp || '', event.message)
        },
      )

      const timeoutListener = AvasOtpAutofillModule.addListener(
        'onTimeout',
        (event: TimeoutEventPayload) => {
          if (__DEV__) console.log('Timeout in hook:', event)
          setError('SMS verification timed out')
          setIsListening(false)
          setLoading(false)
          onTimeoutRef.current?.(event.message)
        },
      )

      const errorListener = AvasOtpAutofillModule.addListener(
        'onError',
        (event: ErrorEventPayload) => {
          if (__DEV__) console.log('Error in hook:', event)
          setError(event.message)
          setIsListening(false)
          setLoading(false)
          onErrorRef.current?.(event.message, event.code)
        },
      )

      // Store subscriptions for cleanup
      eventSubscriptions.current = [smsListener, timeoutListener, errorListener]

      // Start the OTP listener
      await AvasOtpAutofillModule.startOtpListener()

      setIsListening(true)
      setLoading(false)
    } catch (err) {
      if (__DEV__) console.error('Failed to start OTP listener:', err)
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to start OTP listener'
      setError(errorMessage)
      setLoading(false)
      setIsListening(false)
      onErrorRef.current?.(errorMessage, -1)
    }
  }, [isListening, cleanup])

  // Cleanup on unmount
  useEffect(
    function unmount() {
      return cleanup
    },
    [cleanup],
  )

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
