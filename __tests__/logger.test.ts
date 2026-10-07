import { nativeMock as native } from './nativeMock'

jest.mock('../src/native', () => ({
  __esModule: true,
  default: require('./nativeMock').nativeMock.mock,
}))

import { getAppHash, setLogger, waitForOtp, type OtpLogEvent } from '../src'

const SMS = 'Your code is 482913\nFA+9qCX9VSu'

let events: OtpLogEvent[]

beforeEach(() => {
  jest.clearAllMocks()
  events = []
  setLogger((event) => events.push(event))
})

afterEach(() => setLogger(null))

const names = () => events.map((e) => e.event)

describe('setLogger', () => {
  it('logs the start and the received code', async () => {
    const wait = waitForOtp({ length: 6 })
    native.deliver(SMS)
    await wait
    expect(names()).toEqual(['wait.start', 'wait.received'])
    expect(events[0]).toMatchObject({
      level: 'debug',
      data: { length: 6, customPattern: false },
    })
    expect(events[1]).toMatchObject({
      level: 'info',
      data: { codeLength: 6, elapsedMs: expect.any(Number) },
    })
  })

  it('warns when an SMS has no matching code', async () => {
    const wait = waitForOtp({ length: 4 })
    native.deliver(SMS)
    await wait
    expect(events[1]).toMatchObject({
      level: 'warn',
      event: 'wait.no_match',
      data: { messageLength: SMS.length },
    })
  })

  it('never includes the SMS body or the code', async () => {
    const wait = waitForOtp()
    native.deliver(SMS)
    await wait
    const serialized = JSON.stringify(events)
    expect(serialized).not.toContain('482913')
    expect(serialized).not.toContain('FA+9qCX9VSu')
  })

  it('logs a timeout with the elapsed time', async () => {
    const wait = waitForOtp()
    native.fail('TIMEOUT')
    await expect(wait).rejects.toMatchObject({ code: 'TIMEOUT' })
    expect(events[1]).toMatchObject({
      level: 'warn',
      event: 'wait.timeout',
      data: { elapsedMs: expect.any(Number) },
    })
  })

  it('logs native failures as errors with the OtpError', async () => {
    const wait = waitForOtp()
    native.fail('UNAVAILABLE')
    await expect(wait).rejects.toMatchObject({ code: 'UNAVAILABLE' })
    expect(events[1]).toMatchObject({
      level: 'error',
      event: 'wait.failed',
      error: { name: 'OtpError', code: 'UNAVAILABLE' },
      data: { code: 'UNAVAILABLE' },
    })
  })

  it('logs aborts at debug level', async () => {
    const controller = new AbortController()
    const wait = waitForOtp({ signal: controller.signal })
    controller.abort()
    await expect(wait).rejects.toMatchObject({ code: 'ABORTED' })
    expect(events[1]).toMatchObject({ level: 'debug', event: 'wait.aborted' })
  })

  it('logs invalid options as errors', async () => {
    await expect(waitForOtp({ length: 0 })).rejects.toThrow(RangeError)
    expect(events).toEqual([
      expect.objectContaining({
        level: 'error',
        event: 'wait.invalid_options',
        error: expect.any(RangeError),
      }),
    ])
  })

  it('logs app-hash problems', async () => {
    native.mock.getAppHash.mockResolvedValueOnce(null as unknown as string)
    await expect(getAppHash()).resolves.toBeNull()
    native.mock.getAppHash.mockRejectedValueOnce(
      Object.assign(new Error('boom'), { code: 'FAILED' }),
    )
    await expect(getAppHash()).rejects.toMatchObject({ code: 'FAILED' })
    expect(events).toEqual([
      expect.objectContaining({ level: 'warn', event: 'hash.missing' }),
      expect.objectContaining({ level: 'error', event: 'hash.failed' }),
    ])
  })

  it('keeps working when the logger throws', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    setLogger(() => {
      throw new Error('logger down')
    })
    const wait = waitForOtp()
    native.deliver(SMS)
    await expect(wait).resolves.toMatchObject({ otp: '482913' })
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('stops logging after setLogger(null)', async () => {
    setLogger(null)
    const wait = waitForOtp()
    native.deliver(SMS)
    await wait
    expect(events).toEqual([])
  })
})
