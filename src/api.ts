import { createOtpExtractor, type ExtractOtpOptions } from './extractOtp'
import { log } from './logger'
import { Platform } from 'react-native'
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

const MODULE_MISSING_MESSAGE =
  'The OtpAutofill native module is not linked. Rebuild the app with this library installed.'

const isModuleMissing = () => Platform.OS === 'android' && native == null
let moduleMissingLogged = false

// Android without the module usually means JS was updated over the air onto a
// binary built without this library, so say so once instead of failing quietly.
function logModuleMissing() {
  if (!isModuleMissing() || moduleMissingLogged) return
  moduleMissingLogged = log({
    level: 'error',
    event: 'module.missing',
    message: MODULE_MISSING_MESSAGE,
  })
}

/**
 * The 11-character app hash the SMS must end with, or null on platforms
 * without SMS Retriever.
 */
export async function getAppHash(): Promise<string | null> {
  if (!native) {
    logModuleMissing()
    return null
  }
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
    log({
      level: 'error',
      event: 'hash.failed',
      message: error.message,
      error,
      data: { code: error.code },
    })
    throw error
  }
}

let activeWait: object | null = null

/**
 * Waits for one SMS that ends with this app's hash. The wait ends when Android's
 * 5-minute listening session ends, or 5 minutes after the one new session the
 * library opens if Android closes a stale one during the wait.
 * Only one wait runs at a time: starting another aborts the previous one.
 */
export function waitForOtp(
  options: WaitForOtpOptions = {},
): Promise<OtpResult> {
  const { signal, ...extractOptions } = options
  if (!native) {
    logModuleMissing()
    const error = new OtpError(
      'UNSUPPORTED',
      isModuleMissing()
        ? MODULE_MISSING_MESSAGE
        : 'SMS Retriever is only available on Android',
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
    const error = cause as OtpError
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
  const data = { elapsedMs, code: error.code }
  if (error.code === 'ABORTED') {
    log({ level: 'debug', event: 'wait.aborted', message: error.message, data })
  } else if (error.code === 'TIMEOUT') {
    log({ level: 'warn', event: 'wait.timeout', message: error.message, data })
  } else {
    // UNAVAILABLE is a device condition (no Play Services), not a bug.
    const level = error.code === 'UNAVAILABLE' ? 'warn' : 'error'
    log({ level, event: 'wait.failed', message: error.message, error, data })
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
