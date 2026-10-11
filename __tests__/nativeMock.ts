type Pending = {
  resolve: (message: string) => void
  reject: (error: unknown) => void
}

// Mirrors the Kotlin module: one wait at a time, a new start or a stop rejects
// the previous wait with CANCELLED.
export function createNativeMock() {
  let pending: Pending | null = null

  const cancel = () => {
    const current = pending
    pending = null
    current?.reject(Object.assign(new Error('Stopped'), { code: 'CANCELLED' }))
  }

  const mock = {
    getAppHash: jest.fn(async () => 'FA+9qCX9VSu'),
    startListening: jest.fn(
      () =>
        new Promise<string>((resolve, reject) => {
          cancel()
          pending = { resolve, reject }
        }),
    ),
    stopListening: jest.fn(cancel),
  }

  return {
    mock,
    deliver(message: string) {
      const current = pending
      pending = null
      current?.resolve(message)
    },
    fail(code: string) {
      const current = pending
      pending = null
      current?.reject(Object.assign(new Error(code), { code }))
    },
    get listening() {
      return pending !== null
    },
  }
}

export const nativeMock = createNativeMock()
