import { extractOtp } from '../src/extractOtp'

const HASH = 'FA+9qCX9VSu'

describe('extractOtp', () => {
  it('reads the code after an OTP keyword', () => {
    expect(extractOtp(`Your verification code is 482913\n${HASH}`)).toBe(
      '482913',
    )
  })

  it('reads a standalone digit run', () => {
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
  })

  it('matches an exact length', () => {
    const sms = `Your code is 567890\n${HASH}`
    expect(extractOtp(sms, { length: 6 })).toBe('567890')
    expect(extractOtp(sms, { length: 4 })).toBeNull()
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

  it('rejects invalid options with an OtpError', () => {
    const invalid = { name: 'OtpError', code: 'INVALID_OPTIONS' }
    expect(() => extractOtp('', { length: 4, pattern: /x/ })).toThrow(
      expect.objectContaining(invalid),
    )
    expect(() => extractOtp('', { length: 0 })).toThrow(
      expect.objectContaining(invalid),
    )
    expect(() => extractOtp('', { length: 4.5 })).toThrow(
      expect.objectContaining(invalid),
    )
    expect(() =>
      extractOtp('', { pattern: 'abc' as unknown as RegExp }),
    ).toThrow(expect.objectContaining(invalid))
  })

  describe('whole tokens only', () => {
    it('does not read an amount before the code as the code', () => {
      expect(
        extractOtp(`OTP for MVR 1500.00 payment is 482913\n${HASH}`),
      ).toBeNull()
    })

    it.each([
      'Total 1500.00 due',
      'Total 1,500 due',
      'Total 1,5000 due',
      'Ref 482-913 due',
      'Ref 4829-1300 due',
      'Item A1234 due',
      'Item 1234abc due',
      'Item 12345678901 due',
    ])('ignores a number inside "%s"', (sms) => {
      expect(extractOtp(sms)).toBeNull()
    })

    it('accepts a code at the end of a sentence', () => {
      expect(extractOtp('Your code is 4821.')).toBe('4821')
      expect(extractOtp('Use 4821, then sign in')).toBe('4821')
    })

    it('applies the same rules with length', () => {
      expect(
        extractOtp('Pay 1500.00 now. Code 482913', { length: 4 }),
      ).toBeNull()
      expect(
        extractOtp('Pay 1500.00 now. Code 482913', { length: 6 }),
      ).toBeNull()
    })
  })

  describe('ambiguity', () => {
    it('returns null when standalone numbers differ', () => {
      expect(
        extractOtp('Pay MVR 2500 to confirm. Use 4821 to verify.'),
      ).toBeNull()
    })

    it.each([
      'OTP for MVR 1500 payment is 482913',
      '482913 is your OTP to pay MVR 1500',
      'OTP for your 2026 renewal: 482913',
      'Your OTP for order 7781 is 482913',
      '482913 is your verification code. Ref: 5521',
      '123456 is your Swiggy OTP for order #45678',
      'OTP for MVR 1500.00 payment is 482913 and 7781',
      'Code 2026 expires. Your code: 482913',
      'Pay MVR 2500 now. Your code: 4821',
    ])('returns null when "%s" holds two numbers', (sms) => {
      expect(extractOtp(`${sms}\n${HASH}`)).toBeNull()
    })

    it('does not let length pick the code among other long numbers', () => {
      expect(
        extractOtp('Your OTP for order 7781 is 482913', { length: 6 }),
      ).toBeNull()
    })

    it.each([
      'Your WhatsApp code: 482-913. Help: 1919',
      'Your code is 482 913. Valid until 14/10/2026',
      'Your code is A48291. Ref 5521',
      'Your code is \u0664\u0668\u0662\u0669\u0661\u0663. Order 7781',
      'Code: 4821_ ref 5521',
    ])('returns null when the real code is not a clean token: "%s"', (sms) => {
      expect(extractOtp(`${sms}\n${HASH}`)).toBeNull()
    })

    it('returns null for a split code even with length', () => {
      expect(
        extractOtp(`Your code is 482 913. Ref 778190\n${HASH}`, { length: 6 }),
      ).toBeNull()
    })

    it('still reads a custom pattern past other numbers', () => {
      expect(
        extractOtp('Your OTP for order 7781 is 482913', {
          pattern: /is (\d{6})/,
        }),
      ).toBe('482913')
    })

    it('accepts the same code repeated', () => {
      expect(extractOtp('Code 4821. Again, your code: 4821')).toBe('4821')
      expect(extractOtp('Use 4821 now. 4821 expires soon')).toBe('4821')
    })
  })

  describe('real Avas SMS', () => {
    it('reads the code before a hash on its own line', () => {
      expect(extractOtp(`Your Avas verification code is 4821\n\n${HASH}`)).toBe(
        '4821',
      )
    })

    it('strips a hash that starts with digits', () => {
      expect(extractOtp('Your code is 482913\n\n12345678+Ab')).toBe('482913')
      expect(extractOtp('Welcome back!\n12345678+Ab')).toBeNull()
    })

    it('reads the Avas template with the hash on the same line', () => {
      expect(
        extractOtp(
          'Your OTP verification code is 4821. = Avas App = FA+9qCX9VSu',
        ),
      ).toBe('4821')
    })

    it('strips a hash on the same line', () => {
      expect(extractOtp(`Your code is 482913 ${HASH}`)).toBe('482913')
      expect(extractOtp('Welcome back! 12345678+Ab')).toBeNull()
    })
  })
})
