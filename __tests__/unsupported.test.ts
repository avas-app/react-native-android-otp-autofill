import { getAppHash, isSupported, waitForOtp } from '../src'

// Jest resolves the iOS build of ./native, the same as an iOS or web app.
describe('without the native module', () => {
  it('reports unsupported', async () => {
    expect(isSupported).toBe(false)
    await expect(getAppHash()).resolves.toBeNull()
    await expect(waitForOtp()).rejects.toMatchObject({ code: 'UNSUPPORTED' })
  })
})

describe('logging without the native module', () => {
  it('logs unsupported waits at debug level', async () => {
    const { setLogger } = require('../src')
    const events: { level: string; event: string }[] = []
    setLogger((e: { level: string; event: string }) => events.push(e))
    await expect(waitForOtp()).rejects.toMatchObject({ code: 'UNSUPPORTED' })
    setLogger(null)
    expect(events).toEqual([
      expect.objectContaining({ level: 'debug', event: 'wait.unsupported' }),
    ])
  })
})
