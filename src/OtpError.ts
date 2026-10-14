export type OtpErrorCode =
  | 'UNSUPPORTED'
  | 'UNAVAILABLE'
  | 'TIMEOUT'
  | 'ABORTED'
  | 'FAILED'
  | 'INVALID_OPTIONS'

export class OtpError extends Error {
  readonly code: OtpErrorCode

  constructor(code: OtpErrorCode, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'OtpError'
    this.code = code
  }
}
