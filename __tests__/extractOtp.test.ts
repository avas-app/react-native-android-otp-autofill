import { extractOtp } from '../src/extractOtp'

const HASH = 'FA+9qCX9VSu'

describe('extractOtp', () => {
  it('reads the code after an OTP keyword', () => {
    expect(extractOtp(`Your verification code is 482913\n${HASH}`)).toBe(
      '482913',
    )
  })

  it('prefers the keyword code over an earlier number', () => {
    expect(extractOtp(`Order 55512 confirmed. Your code: 1234\n${HASH}`)).toBe(
      '1234',
    )
  })

  it('falls back to a standalone digit run', () => {
    expect(extractOtp(`Use 9876 to sign in\n${HASH}`)).toBe('9876')
  })

  it('ignores digits in the app-hash line', () => {
    expect(extractOtp('Welcome back!\n12345abcdeF')).toBeNull()
  })

  it('does not match a keyword inside another word', () => {
    expect(extractOtp(`barcode 12 then 4321\n${HASH}`)).toBe('4321')
  })

  it('does not truncate longer numbers', () => {
    expect(extractOtp(`Call 0123456789 now\n${HASH}`)).toBeNull()
  })

  it('does not read past the end of the keyword line', () => {
    expect(extractOtp(`Your code is\n123456\n${HASH}`)).toBe('123456')
    expect(extractOtp(`Your code is below\nRef 9999 and 123456\n${HASH}`)).toBe(
      '9999',
    )
  })

  it('matches an exact length', () => {
    const sms = `Ref 1234. Your code is 567890\n${HASH}`
    expect(extractOtp(sms, { length: 6 })).toBe('567890')
    expect(extractOtp(sms, { length: 4 })).toBe('1234')
    expect(extractOtp(sms, { length: 5 })).toBeNull()
  })

  it('uses the first capture group of a custom pattern', () => {
    expect(
      extractOtp(`Code: AB-12CD\n${HASH}`, { pattern: /AB-(\w{4})/ }),
    ).toBe('12CD')
  })

  it('uses the whole match when the pattern has no group', () => {
    expect(
      extractOtp(`Code: X7Y8Z9\n${HASH}`, { pattern: /[A-Z]\d[A-Z]\d[A-Z]\d/ }),
    ).toBe('X7Y8Z9')
  })

  it('applies a custom pattern after stripping the hash line', () => {
    expect(
      extractOtp(`No code here\n${HASH}`, { pattern: /\w{11}/ }),
    ).toBeNull()
  })

  it('ignores lastIndex on a global pattern', () => {
    const pattern = /(\d{4})/g
    expect(extractOtp(`a 1111\n${HASH}`, { pattern })).toBe('1111')
    expect(extractOtp(`a 2222\n${HASH}`, { pattern })).toBe('2222')
  })

  it('rejects invalid options', () => {
    expect(() => extractOtp('', { length: 4, pattern: /x/ })).toThrow(TypeError)
    expect(() => extractOtp('', { length: 0 })).toThrow(RangeError)
    expect(() => extractOtp('', { length: 4.5 })).toThrow(RangeError)
  })
})
