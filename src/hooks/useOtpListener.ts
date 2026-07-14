import {
  ErrorEventPayload,
  SmsReceivedEventPayload,
  TimeoutEventPayload,
} from '../AvasOtpAutofill.types'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'

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

  // Mirrors isListening so startListener can guard on it without taking it as a
  // dependency — otherwise startListener's identity flips every time the listen state
  // changes, and a caller doing useEffect(() => { startListener() }, [startListener])
  // would start a brand-new listener after every received OTP.
  const isListeningRef = useRef(false)
  const setListening = useCallback((value: boolean) => {
    isListeningRef.current = value
    setIsListening(value)
  }, [])

  const cleanup = useCallback(() => {
    // Remove all event subscriptions
    eventSubscriptions.current.forEach((subscription) => subscription.remove())
    eventSubscriptions.current = []

    // Stop the SMS retriever
    AvasOtpAutofillModule.stopSmsRetriever().catch((err) => {
      if (__DEV__) console.error('Failed to stop SMS retriever:', err)
    })

    setListening(false)
    setLoading(false)
  }, [setListening])

  const stopListener = useCallback(() => {
    cleanup()
  }, [cleanup])

  const startListener = useCallback(async () => {
    // SMS Retriever is Android-only; no-op elsewhere.
    if (Platform.OS !== 'android') return

    if (isListeningRef.current) {
      if (__DEV__) console.warn('SMS listener is already active')
      return
    }

    // Clear any prior run (subscriptions + native retriever) BEFORE flipping loading
    // on, so cleanup's setLoading(false) can't cancel out our setLoading(true).
    cleanup()

    try {
      setLoading(true)
      setError(null)
      setReceivedOtp(null)
      setReceivedMessage(null)

      // Set up event listeners
      const smsListener = AvasOtpAutofillModule.addListener(
        'onSmsReceived',
        (event: SmsReceivedEventPayload) => {
          if (__DEV__) console.log('SMS received in hook:', event)
          setReceivedOtp(event.otp || null)
          setReceivedMessage(event.message)
          setListening(false)
          setLoading(false)
          onOtpReceivedRef.current?.(event.otp || '', event.message)
        },
      )

      const timeoutListener = AvasOtpAutofillModule.addListener(
        'onTimeout',
        (event: TimeoutEventPayload) => {
          if (__DEV__) console.log('Timeout in hook:', event)
          setError('SMS verification timed out')
          setListening(false)
          setLoading(false)
          onTimeoutRef.current?.(event.message)
        },
      )

      const errorListener = AvasOtpAutofillModule.addListener(
        'onError',
        (event: ErrorEventPayload) => {
          if (__DEV__) console.log('Error in hook:', event)
          setError(event.message)
          setListening(false)
          setLoading(false)
          onErrorRef.current?.(event.message, event.code)
        },
      )

      // Store subscriptions for cleanup
      eventSubscriptions.current = [smsListener, timeoutListener, errorListener]

      // Start the OTP listener. A resolved promise does NOT imply a registered
      // receiver: the native side resolves false when the start was cancelled by a
      // concurrent stop. Treating that as success would leave isListening=true with no
      // receiver attached, and the already-active guard would then block every retry —
      // silently killing autofill until remount.
      const started = await AvasOtpAutofillModule.startOtpListener()
      if (!started) {
        cleanup()
        return
      }

      setListening(true)
      setLoading(false)
    } catch (err) {
      if (__DEV__) console.error('Failed to start OTP listener:', err)
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to start OTP listener'
      // Remove the listeners we just added (cleanup also clears loading/listening).
      cleanup()
      setError(errorMessage)
      onErrorRef.current?.(errorMessage, -1)
    }
  }, [cleanup, setListening])

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
