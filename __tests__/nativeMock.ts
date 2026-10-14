type Pending = {
  resolve: (message: string) => void
  reject: (error: unknown) => void
}

// Like the Kotlin module, start and stop settle in order after the call returns, as on the main thread.
export function createNativeMock() {
  let pending: Pending | null = null
  let queue: Promise<void> = Promise.resolve()

  const post = (task: () => void) => {
    queue = queue.then(task)
  }

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
          post(() => {
            cancel()
            pending = { resolve, reject }
          })
        }),
    ),
    stopListening: jest.fn(() => post(cancel)),
  }

  return {
    mock,
    settled: () => queue,
    async deliver(message: string) {
      await queue
      const current = pending
      pending = null
      current?.resolve(message)
    },
    async fail(code: string) {
      await queue
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
