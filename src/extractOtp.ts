import { OtpError } from './OtpError'

export type ExtractOtpOptions = {
  /** Exact number of digits in the code. Defaults to any 4 to 8 digit run. */
  length?: number
  /**
   * Custom matcher, used instead of the built-in rules. The first capture
   * group is the code, or the whole match when there is no group.
   */
  pattern?: RegExp
}

// The app hash can start with digits that would pass as a code.
const TRAILING_HASH = /\s+[A-Za-z0-9+/]{11}\s*$/

/** Validates the options up front and returns a reusable extractor. */
export function createOtpExtractor(
  options: ExtractOtpOptions = {},
): (message: string) => string | null {
  const { length, pattern } = options
  if (length !== undefined && pattern !== undefined) {
    throw new OtpError(
      'INVALID_OPTIONS',
      'Pass either `length` or `pattern`, not both',
    )
  }
  if (length !== undefined && (!Number.isInteger(length) || length < 1)) {
    throw new OtpError('INVALID_OPTIONS', '`length` must be a positive integer')
  }

  if (pattern !== undefined && !(pattern instanceof RegExp)) {
    throw new OtpError('INVALID_OPTIONS', '`pattern` must be a RegExp')
  }

  if (pattern) {
    // Drop g/y so lastIndex can't make a match depend on earlier calls.
    const custom = new RegExp(
      pattern.source,
      pattern.flags.replace(/[gy]/g, ''),
    )
    return (message) => {
      const match = custom.exec(message.replace(TRAILING_HASH, ''))
      return match ? (match[1] ?? match[0]) : null
    }
  }

  // Not part of a bigger token such as 1500.00, 1,500, 482-913 or A1234.
  const digits = length === undefined ? '\\d{4,8}' : `\\d{${length}}`
  const candidate = `(?<!\\w)(?<!\\d[.,-])(${digits})(?!\\w)(?![.,-]\\d)`
  const standalone = new RegExp(candidate, 'g')

  return (message) => {
    const body = message.replace(TRAILING_HASH, '')
    const found = new Set(Array.from(body.matchAll(standalone), (m) => m[1]!))
    if (found.size !== 1) return null
    const code = [...found][0]!
    // Another long digit run may be the real code in a form we can't read.
    const rival = body.match(/\p{Nd}{3,}/gu)?.some((run) => run !== code)
    return rival ? null : code
  }
}

/** Pulls the one-time code out of an SMS Retriever message. */
export function extractOtp(
  message: string,
  options?: ExtractOtpOptions,
): string | null {
  return createOtpExtractor(options)(message)
}
