import { nativeMock as native } from './nativeMock'

jest.mock('../src/native', () => ({
  __esModule: true,
  default: require('./nativeMock').nativeMock.mock,
}))

import { getAppHash, OtpError, waitForOtp } from '../src'

const SMS = 'Your code is 482913\nFA+9qCX9VSu'

beforeEach(() => jest.clearAllMocks())

describe('waitForOtp', () => {
  it('resolves with the message and extracted code', async () => {
    const wait = waitForOtp()
    native.deliver(SMS)
    await expect(wait).resolves.toEqual({ message: SMS, otp: '482913' })
  })

  it('resolves with a null code when none matches', async () => {
    const wait = waitForOtp({ length: 4 })
    native.deliver(SMS)
    await expect(wait).resolves.toEqual({ message: SMS, otp: null })
  })

  it.each([
    ['TIMEOUT', 'TIMEOUT'],
    ['UNAVAILABLE', 'UNAVAILABLE'],
    ['CANCELLED', 'ABORTED'],
    ['FAILED', 'FAILED'],
    ['SOMETHING_ELSE', 'FAILED'],
  ])('maps native %s to %s', async (nativeCode, code) => {
    const wait = waitForOtp()
    native.fail(nativeCode)
    await expect(wait).rejects.toMatchObject({ name: 'OtpError', code })
  })

  it('stops the native listener on abort', async () => {
    const controller = new AbortController()
    const wait = waitForOtp({ signal: controller.signal })
    controller.abort()
    await expect(wait).rejects.toMatchObject({ code: 'ABORTED' })
    expect(native.mock.stopListening).toHaveBeenCalledTimes(1)
  })

  it('rejects without starting when already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(
      waitForOtp({ signal: controller.signal }),
    ).rejects.toMatchObject({ code: 'ABORTED' })
    expect(native.mock.startListening).not.toHaveBeenCalled()
  })

  it('rejects invalid options without starting', async () => {
    await expect(waitForOtp({ length: -1 })).rejects.toThrow(RangeError)
    expect(native.mock.startListening).not.toHaveBeenCalled()
  })

  it('aborts the previous wait when a new one starts', async () => {
    const first = waitForOtp()
    const second = waitForOtp()
    await expect(first).rejects.toMatchObject({ code: 'ABORTED' })
    native.deliver(SMS)
    await expect(second).resolves.toMatchObject({ otp: '482913' })
  })

  it('does not stop a newer wait when a superseded one is aborted', async () => {
    const controller = new AbortController()
    const first = waitForOtp({ signal: controller.signal })
    const second = waitForOtp()
    controller.abort()
    await expect(first).rejects.toMatchObject({ code: 'ABORTED' })
    expect(native.mock.stopListening).not.toHaveBeenCalled()
    expect(native.listening).toBe(true)
    native.deliver(SMS)
    await expect(second).resolves.toMatchObject({ otp: '482913' })
  })

  it('ignores abort after settling', async () => {
    const controller = new AbortController()
    const wait = waitForOtp({ signal: controller.signal })
    native.deliver(SMS)
    await wait
    controller.abort()
    expect(native.mock.stopListening).not.toHaveBeenCalled()
  })
})

describe('getAppHash', () => {
  it('returns the native hash', async () => {
    await expect(getAppHash()).resolves.toBe('FA+9qCX9VSu')
  })

  it('wraps native errors in OtpError', async () => {
    native.mock.getAppHash.mockRejectedValueOnce(
      Object.assign(new Error('boom'), { code: 'FAILED' }),
    )
    const error = await getAppHash().catch((e: unknown) => e)
    expect(error).toBeInstanceOf(OtpError)
    expect(error).toMatchObject({ code: 'FAILED', message: 'boom' })
  })
})
