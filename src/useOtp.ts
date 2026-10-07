import { useCallback, useEffect, useRef, useState } from 'react'

import { isSupported, waitForOtp } from './api'
import type { ExtractOtpOptions } from './extractOtp'
import { OtpError } from './OtpError'

export type OtpStatus = 'idle' | 'listening' | 'received' | 'timeout' | 'error'

export type UseOtpOptions = ExtractOtpOptions & {
  /** Start listening on mount. Defaults to true. */
  autoStart?: boolean
  /** Called when an SMS with a code arrives. Needn't be memoized. */
  onOtp?: (otp: string, message: string) => void
}

export type UseOtpResult = {
  status: OtpStatus
  otp: string | null
  message: string | null
  error: OtpError | null
  /** Starts listening, replacing any wait in progress. Call it after a resend. */
  start: () => void
  stop: () => void
}

type State = Pick<UseOtpResult, 'status' | 'otp' | 'message' | 'error'>

const IDLE: State = { status: 'idle', otp: null, message: null, error: null }
const LISTENING: State = { ...IDLE, status: 'listening' }

export function useOtp(options: UseOtpOptions = {}): UseOtpResult {
  const autoStart = (options.autoStart ?? true) && isSupported
  const [state, setState] = useState<State>(autoStart ? LISTENING : IDLE)
  const controllerRef = useRef<AbortController | null>(null)

  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  })

  // Sync status with autoStart during render rather than in the effect below,
  // which would cost an extra render.
  const [prevAutoStart, setPrevAutoStart] = useState(autoStart)
  if (autoStart !== prevAutoStart) {
    setPrevAutoStart(autoStart)
    if (autoStart) setState(LISTENING)
    else setState((s) => (s.status === 'listening' ? IDLE : s))
  }

  const cancel = useCallback(() => {
    controllerRef.current?.abort()
    controllerRef.current = null
  }, [])

  // Waits for the SMS. Callers set the listening status themselves.
  const listen = useCallback(() => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller

    const { length, pattern } = optionsRef.current
    waitForOtp({ signal: controller.signal, length, pattern }).then(
      ({ otp, message }) => {
        if (controllerRef.current !== controller) return
        controllerRef.current = null
        setState({ status: 'received', otp, message, error: null })
        if (otp !== null) optionsRef.current.onOtp?.(otp, message)
      },
      (cause: unknown) => {
        if (controllerRef.current !== controller) return
        controllerRef.current = null
        const error =
          cause instanceof OtpError
            ? cause
            : new OtpError('FAILED', String(cause), { cause })
        setState({
          ...IDLE,
          status: error.code === 'TIMEOUT' ? 'timeout' : 'error',
          error,
        })
      },
    )
  }, [])

  const start = useCallback(() => {
    if (!isSupported) return
    setState(LISTENING)
    listen()
  }, [listen])

  const stop = useCallback(() => {
    cancel()
    setState((s) => (s.status === 'listening' ? IDLE : s))
  }, [cancel])

  useEffect(() => {
    if (autoStart) listen()
    return cancel
  }, [autoStart, listen, cancel])

  return { ...state, start, stop }
}
