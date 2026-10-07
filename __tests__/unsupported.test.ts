import { getAppHash, isSupported, waitForOtp } from '../src'

// Jest resolves the iOS build of ./native, the same as an iOS or web app.
describe('without the native module', () => {
  it('reports unsupported', async () => {
    expect(isSupported).toBe(false)
    await expect(getAppHash()).resolves.toBeNull()
    await expect(waitForOtp()).rejects.toMatchObject({ code: 'UNSUPPORTED' })
  })
})
