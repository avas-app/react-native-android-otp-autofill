import { createOtpExtractor, type ExtractOtpOptions } from './extractOtp'
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
    return await native.getAppHash()
  } catch (error) {
    throw toOtpError(error)
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
    return Promise.reject(
      new OtpError('UNSUPPORTED', 'SMS Retriever is only available on Android'),
    )
  }
  if (signal?.aborted) {
    return Promise.reject(new OtpError('ABORTED', 'Aborted'))
  }
  let extract: (message: string) => string | null
  try {
    extract = createOtpExtractor(extractOptions)
  } catch (error) {
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

  return module
    .startListening()
    .then(
      (message) => ({ message, otp: extract(message) }),
      (error) => {
        throw toOtpError(error)
      },
    )
    .finally(() => {
      signal?.removeEventListener('abort', onAbort)
      if (activeWait === token) activeWait = null
    })
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
