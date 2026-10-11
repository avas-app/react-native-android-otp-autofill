import { act, renderHook } from '@testing-library/react-native'
import { StrictMode } from 'react'

import { nativeMock as native } from './nativeMock'

jest.mock('../src/native', () => ({
  __esModule: true,
  default: require('./nativeMock').nativeMock.mock,
}))

import { useOtp } from '../src'

const SMS = 'Your code is 482913\nFA+9qCX9VSu'

beforeEach(() => jest.clearAllMocks())

describe('useOtp', () => {
  it('starts on mount and reports the code', async () => {
    const onOtp = jest.fn()
    const { result } = await renderHook(() => useOtp({ onOtp }))
    expect(result.current.status).toBe('listening')

    await act(async () => native.deliver(SMS))

    expect(result.current).toMatchObject({
      status: 'received',
      otp: '482913',
      message: SMS,
      error: null,
    })
    expect(onOtp).toHaveBeenCalledWith('482913', SMS)
  })

  it('waits for start() when autoStart is false', async () => {
    const { result } = await renderHook(() => useOtp({ autoStart: false }))
    expect(result.current.status).toBe('idle')
    expect(native.mock.startListening).not.toHaveBeenCalled()

    await act(async () => result.current.start())
    expect(result.current.status).toBe('listening')
  })

  it('reports a timeout', async () => {
    const { result } = await renderHook(() => useOtp())
    await act(async () => native.fail('TIMEOUT'))
    expect(result.current.status).toBe('timeout')
    expect(result.current.error).toMatchObject({ code: 'TIMEOUT' })
  })

  it('restarts after a timeout, e.g. on resend', async () => {
    const { result } = await renderHook(() => useOtp())
    await act(async () => native.fail('TIMEOUT'))
    await act(async () => result.current.start())
    expect(result.current).toMatchObject({ status: 'listening', error: null })

    await act(async () => native.deliver(SMS))
    expect(result.current.otp).toBe('482913')
  })

  it('stays listening when start() replaces a running wait', async () => {
    const { result } = await renderHook(() => useOtp())
    await act(async () => result.current.start())
    // The first wait's ABORTED rejection must not clobber the new state.
    expect(result.current.status).toBe('listening')
    expect(native.listening).toBe(true)

    await act(async () => native.deliver(SMS))
    expect(result.current.status).toBe('received')
  })

  it('goes idle on stop() and ignores the cancellation', async () => {
    const { result } = await renderHook(() => useOtp())
    await act(async () => result.current.stop())
    expect(result.current).toMatchObject({ status: 'idle', error: null })
    expect(native.listening).toBe(false)
  })

  it('stops listening on unmount', async () => {
    const { unmount } = await renderHook(() => useOtp())
    await act(async () => unmount())
    expect(native.mock.stopListening).toHaveBeenCalled()
    expect(native.listening).toBe(false)
  })

  it('uses the latest length when starting', async () => {
    const { result, rerender } = await renderHook(
      ({ length }: { length: number }) => useOtp({ autoStart: false, length }),
      { initialProps: { length: 4 } },
    )
    await rerender({ length: 6 })
    await act(async () => result.current.start())
    await act(async () => native.deliver(SMS))
    expect(result.current.otp).toBe('482913')
  })

  it('calls the latest onOtp without restarting', async () => {
    const first = jest.fn()
    const second = jest.fn()
    const { rerender } = await renderHook(
      ({ onOtp }: { onOtp: jest.Mock }) => useOtp({ onOtp }),
      { initialProps: { onOtp: first } },
    )
    await rerender({ onOtp: second })
    expect(native.mock.startListening).toHaveBeenCalledTimes(1)

    await act(async () => native.deliver(SMS))
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledWith('482913', SMS)
  })
})

describe('useOtp autoStart changes', () => {
  it('follows autoStart turning on and off', async () => {
    const { result, rerender } = await renderHook(
      ({ autoStart }: { autoStart: boolean }) => useOtp({ autoStart }),
      { initialProps: { autoStart: false } },
    )
    expect(result.current.status).toBe('idle')

    await rerender({ autoStart: true })
    expect(result.current.status).toBe('listening')
    expect(native.listening).toBe(true)

    await rerender({ autoStart: false })
    expect(result.current.status).toBe('idle')
    expect(native.listening).toBe(false)
  })

  it('keeps listening through a StrictMode remount', async () => {
    const { result } = await renderHook(() => useOtp(), { wrapper: StrictMode })
    expect(result.current.status).toBe('listening')
    expect(native.listening).toBe(true)

    await act(async () => native.deliver(SMS))
    expect(result.current.otp).toBe('482913')
  })
})
