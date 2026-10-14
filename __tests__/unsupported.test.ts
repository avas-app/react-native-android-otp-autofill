import {
  getAppHash,
  isSupported,
  setLogger,
  waitForOtp,
  type OtpLogEvent,
} from '../src'

// Jest resolves the iOS build of ./native, the same as an iOS or web app.
describe('without the native module', () => {
  it('reports unsupported', async () => {
    expect(isSupported).toBe(false)
    await expect(getAppHash()).resolves.toBeNull()
    await expect(waitForOtp()).rejects.toMatchObject({
      code: 'UNSUPPORTED',
      message: expect.stringContaining('only available on Android'),
    })
  })
})

describe('logging without the native module', () => {
  it('logs unsupported waits at debug level', async () => {
    const events: OtpLogEvent[] = []
    const stop = setLogger((e) => events.push(e))
    await expect(waitForOtp()).rejects.toMatchObject({ code: 'UNSUPPORTED' })
    stop()
    expect(events).toEqual([
      expect.objectContaining({ level: 'debug', event: 'wait.unsupported' }),
    ])
  })
})
