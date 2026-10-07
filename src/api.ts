import { createOtpExtractor, type ExtractOtpOptions } from './extractOtp'
import { log } from './logger'
import native from './native'
import { OtpError } from './OtpError'

export type WaitForOtpOptions = ExtractOtpOptions & {
  /** Aborting stops the listener and rejects with code `ABORTED`. */
  signal?: AbortSignal
}

export type OtpResult = {
  /** The extracted code, or null when the SMS had none. */
  otp: string | null
  /** The full SMS body, including the app-hash line. */
  message: string
}

/** True on Android when the native module is linked. */
export const isSupported = native != null

/**
 * The 11-character app hash the SMS must end with, or null on platforms
 * without SMS Retriever.
 */
export async function getAppHash(): Promise<string | null> {
  if (!native) return null
  try {
    const hash = await native.getAppHash()
    if (hash === null) {
      log({
        level: 'warn',
        event: 'hash.missing',
        message: 'The app has no signing certificate to hash',
      })
    }
    return hash
  } catch (cause) {
    const error = toOtpError(cause)
    log({ level: 'error', event: 'hash.failed', message: error.message, error })
    throw error
  }
}

let activeWait: object | null = null

/**
 * Waits for one SMS that ends with this app's hash, for up to 5 minutes.
 * Only one wait runs at a time: starting another aborts the previous one.
 */
export function waitForOtp(
  options: WaitForOtpOptions = {},
): Promise<OtpResult> {
  const { signal, ...extractOptions } = options
  if (!native) {
    const error = new OtpError(
      'UNSUPPORTED',
      'SMS Retriever is only available on Android',
    )
    log({ level: 'debug', event: 'wait.unsupported', message: error.message })
    return Promise.reject(error)
  }
  if (signal?.aborted) {
    return Promise.reject(new OtpError('ABORTED', 'Aborted'))
  }
  let extract: (message: string) => string | null
  try {
    extract = createOtpExtractor(extractOptions)
  } catch (cause) {
    const error = cause instanceof Error ? cause : new Error(String(cause))
    log({
      level: 'error',
      event: 'wait.invalid_options',
      message: error.message,
      error,
    })
    return Promise.reject(error)
  }

  const module = native
  const token = {}
  activeWait = token
  // A newer wait has already cancelled this one natively; stopping again would
  // cancel the newer wait instead.
  const onAbort = () => {
    if (activeWait === token) module.stopListening()
  }
  signal?.addEventListener('abort', onAbort)

  const startedAt = Date.now()
  log({
    level: 'debug',
    event: 'wait.start',
    message: 'Waiting for an SMS',
    data: {
      ...(extractOptions.length !== undefined && {
        length: extractOptions.length,
      }),
      customPattern: extractOptions.pattern !== undefined,
    },
  })

  return module
    .startListening()
    .then(
      (message) => {
        const otp = extract(message)
        const elapsedMs = Date.now() - startedAt
        if (otp === null) {
          log({
            level: 'warn',
            event: 'wait.no_match',
            message: 'An SMS arrived but no code matched',
            data: { elapsedMs, messageLength: message.length },
          })
        } else {
          log({
            level: 'info',
            event: 'wait.received',
            message: 'Received a code',
            data: { elapsedMs, codeLength: otp.length },
          })
        }
        return { message, otp }
      },
      (cause) => {
        const error = toOtpError(cause)
        logFailure(error, Date.now() - startedAt)
        throw error
      },
    )
    .finally(() => {
      signal?.removeEventListener('abort', onAbort)
      if (activeWait === token) activeWait = null
    })
}

function logFailure(error: OtpError, elapsedMs: number) {
  const data = { elapsedMs }
  if (error.code === 'ABORTED') {
    log({ level: 'debug', event: 'wait.aborted', message: error.message, data })
  } else if (error.code === 'TIMEOUT') {
    log({ level: 'warn', event: 'wait.timeout', message: error.message, data })
  } else {
    log({
      level: 'error',
      event: 'wait.failed',
      message: error.message,
      error,
      data: { ...data, code: error.code },
    })
  }
}

function toOtpError(error: unknown): OtpError {
  if (error instanceof OtpError) return error
  const code = (error as { code?: unknown } | null)?.code
  const message = error instanceof Error ? error.message : String(error)
  switch (code) {
    case 'TIMEOUT':
      return new OtpError('TIMEOUT', message, { cause: error })
    case 'CANCELLED':
      return new OtpError('ABORTED', message, { cause: error })
    case 'UNAVAILABLE':
      return new OtpError('UNAVAILABLE', message, { cause: error })
    default:
      return new OtpError('FAILED', message, { cause: error })
  }
}
