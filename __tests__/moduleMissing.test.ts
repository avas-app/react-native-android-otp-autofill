jest.mock('../src/native', () => ({
  __esModule: true,
  default: null,
}))

import { Platform } from 'react-native'
import {
  getAppHash,
  isSupported,
  setLogger,
  waitForOtp,
  type OtpLogEvent,
} from '../src'

describe('Android without the native module', () => {
  beforeAll(() => {
    Platform.OS = 'android'
  })

  it('says the module is not linked and logs it once', async () => {
    await expect(getAppHash()).resolves.toBeNull()
    const events: OtpLogEvent[] = []
    const stop = setLogger((e) => events.push(e))

    expect(isSupported).toBe(false)
    await expect(getAppHash()).resolves.toBeNull()
    await expect(waitForOtp()).rejects.toMatchObject({
      code: 'UNSUPPORTED',
      message: expect.stringContaining('not linked'),
    })
    await expect(waitForOtp()).rejects.toMatchObject({ code: 'UNSUPPORTED' })
    stop()

    const missing = events.filter((e) => e.event === 'module.missing')
    expect(missing).toEqual([
      expect.objectContaining({
        level: 'error',
        message: expect.stringContaining('Rebuild'),
      }),
    ])
  })
})
