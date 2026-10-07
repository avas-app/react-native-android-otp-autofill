export type ExtractOtpOptions = {
  /** Exact number of digits in the code. Defaults to any 4 to 8 digit run. */
  length?: number
  /**
   * Custom matcher, used instead of the built-in rules. The first capture
   * group is the code, or the whole match when there is no group.
   */
  pattern?: RegExp
}

// SMS Retriever messages end with the 11-char app hash on its own line. Strip it
// first: for some signing keys it starts with digits that would pass as a code.
const HASH_LINE = /\s*\n[A-Za-z0-9+/=]{11}\s*$/

const KEYWORDS =
  'otp|passcode|code|verification|pin|password|token|authenticate'

/** Validates the options up front and returns a reusable extractor. */
export function createOtpExtractor(
  options: ExtractOtpOptions = {},
): (message: string) => string | null {
  const { length, pattern } = options
  if (length !== undefined && pattern !== undefined) {
    throw new TypeError('Pass either `length` or `pattern`, not both')
  }
  if (length !== undefined && (!Number.isInteger(length) || length < 1)) {
    throw new RangeError('`length` must be a positive integer')
  }

  if (pattern) {
    // Drop g/y so lastIndex can't make a match depend on earlier calls.
    const custom = new RegExp(
      pattern.source,
      pattern.flags.replace(/[gy]/g, ''),
    )
    return (message) => {
      const match = custom.exec(message.replace(HASH_LINE, ''))
      return match ? (match[1] ?? match[0]) : null
    }
  }

  const digits = length === undefined ? '\\d{4,8}' : `\\d{${length}}`
  // Prefer a code that follows an OTP keyword, so a number before it can't win.
  // The gap stops at a newline so it can't run onto the next line.
  const keyword = new RegExp(
    `\\b(?:${KEYWORDS})\\b[^0-9\\n]{0,20}(${digits})(?!\\d)`,
    'i',
  )
  const standalone = new RegExp(`(?<!\\d)(${digits})(?!\\d)`)
  return (message) => {
    const body = message.replace(HASH_LINE, '')
    return keyword.exec(body)?.[1] ?? standalone.exec(body)?.[1] ?? null
  }
}

/** Pulls the one-time code out of an SMS Retriever message. */
export function extractOtp(
  message: string,
  options?: ExtractOtpOptions,
): string | null {
  return createOtpExtractor(options)(message)
}
