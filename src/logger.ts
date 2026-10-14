import type { OtpError } from './OtpError'

export type OtpLogLevel = 'debug' | 'info' | 'warn' | 'error'

export type OtpLogEventName =
  | 'wait.start'
  | 'wait.received'
  | 'wait.no_match'
  | 'wait.timeout'
  | 'wait.aborted'
  | 'wait.failed'
  | 'wait.invalid_options'
  | 'wait.unsupported'
  | 'module.missing'
  | 'hash.missing'
  | 'hash.failed'

export type OtpLogEvent = {
  level: OtpLogLevel
  event: OtpLogEventName
  message: string
  error?: OtpError | Error
  /** Never contains the SMS body or the code. */
  data?: Record<string, string | number | boolean>
}

export type OtpLogger = (event: OtpLogEvent) => void

let logger: OtpLogger | null = null

/**
 * Sends the library's log events to `fn`, or stops sending them with null.
 * Returns a function that stops `fn`, unless another logger has replaced it.
 */
export function setLogger(fn: OtpLogger | null): () => void {
  logger = fn
  return () => {
    if (logger === fn) logger = null
  }
}

/** Returns whether a logger was there to receive the event. */
export function log(event: OtpLogEvent): boolean {
  if (!logger) return false
  try {
    logger(event)
  } catch (error) {
    // A broken logger must not break the OTP flow.
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn('[react-native-otp-autofill] logger threw', error)
    }
  }
  return true
}
