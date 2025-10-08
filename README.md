# React Native OTP Autofill

An Expo module for automatic SMS verification using Android SMS Retriever API.

![NPM Version](https://img.shields.io/npm/v/%40avasapp%2Freact-native-otp-autofill?style=for-the-badge)


## Requirements

- Android API 19+
- Google Play Services
- Expo SDK 49+

## Features

- ✅ Automatic SMS verification using Android SMS Retriever API
- ✅ App signature hash generation for SMS verification
- ✅ OTP extraction from SMS messages
- ✅ Event-based listener system
- ✅ TypeScript support
- ✅ Expo modules API

## Installation

This module is available as an npm package. To use it in your Expo/React Native app:

### npm

```bash
npm install @avasapp/react-native-otp-autofill
```

### bun

```bash
bun add @avasapp/react-native-otp-autofill
```

### yarn

```bash
yarn add @avasapp/react-native-otp-autofill
```

### Quick Start

After installation, you can use the React hooks for the simplest integration:

```typescript
import { useGetHash, useOtpListener } from '@avasapp/react-native-otp-autofill'

// In your component
const { hash } = useGetHash()
const { startListener, receivedOtp } = useOtpListener()
```

## Usage

### React Hooks API (Recommended)

The module provides React hooks for easy integration with modern React apps:

#### useGetHash Hook

```typescript
import React from 'react'
import { useGetHash } from '@avasapp/react-native-otp-autofill'

const AppHashComponent = () => {
  const { hash, loading, error, refetch } = useGetHash({
    onSuccess: (hash) => {
      console.log('App hash loaded:', hash)
    },
    onError: (error) => {
      console.error('Failed to get app hash:', error)
    },
  })

  if (loading) return <p>Loading app hash...</p>
  if (error) return <p>Error: {error.message}</p>

  return (
    <div>
      <p>App Hash: {hash}</p>
      <button onClick={refetch}>Refresh Hash</button>
    </div>
  )
}
```

#### useOtpListener Hook

```typescript
import React from 'react'
import { useOtpListener } from '@avasapp/react-native-otp-autofill'

const SmsVerificationComponent = () => {
  const {
    isListening,
    loading,
    receivedOtp,
    receivedMessage,
    error,
    startListener,
    stopListener,
  } = useOtpListener({
    onOtpReceived: (otp, message) => {
      console.log('OTP received:', otp)
      console.log('Full message:', message)
      // Process the OTP
    },
    onTimeout: (message) => {
      console.log('SMS timeout:', message)
    },
    onError: (error, code) => {
      console.error('SMS error:', error, 'Code:', code)
    },
  })

  return (
    <div>
      <button onClick={startListener} disabled={isListening || loading}>
        {loading
          ? 'Starting...'
          : isListening
          ? 'Listening...'
          : 'Start SMS Listener'}
      </button>

      <button onClick={stopListener} disabled={!isListening}>
        Stop Listener
      </button>

      {receivedOtp && <p>OTP: {receivedOtp}</p>}
      {error && <p>Error: {error}</p>}
    </div>
  )
}
```

#### Complete Example with Both Hooks

```typescript
import React, { useState } from 'react'
import { useGetHash, useOtpListener } from '@avasapp/react-native-otp-autofill'

const SmsVerificationFlow = () => {
  const [step, setStep] = useState<'hash' | 'sms' | 'complete'>('hash')
  const [phoneNumber, setPhoneNumber] = useState('')

  // Get app hash first
  const {
    hash,
    loading: hashLoading,
    error: hashError,
  } = useGetHash({
    onSuccess: (hash) => {
      console.log('Ready to send SMS with hash:', hash)
      setStep('sms')
    },
  })

  // Listen for SMS
  const { isListening, receivedOtp, startListener, stopListener } =
    useOtpListener({
      onOtpReceived: (otp) => {
        console.log('Verification complete:', otp)
        setStep('complete')
        stopListener()
      },
    })

  const sendSms = async () => {
    if (!hash) return

    // Send SMS with your backend API
    await fetch('/api/send-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber,
        appHash: hash,
      }),
    })

    // Start listening for SMS
    startListener()
  }

  if (step === 'hash') {
    return (
      <div>
        <p>Preparing SMS verification...</p>
        {hashLoading && <p>Loading...</p>}
        {hashError && <p>Error: {hashError.message}</p>}
        {hash && <p>Ready! Hash: {hash}</p>}
      </div>
    )
  }

  if (step === 'sms') {
    return (
      <div>
        <input
          type="tel"
          placeholder="Phone number"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
        />
        <button onClick={sendSms} disabled={!phoneNumber}>
          Send SMS
        </button>
        {isListening && <p>Waiting for SMS...</p>}
      </div>
    )
  }

  return (
    <div>
      <p>✅ Verification complete!</p>
      <p>OTP: {receivedOtp}</p>
    </div>
  )
}
```

### Manual API (no hooks)

If you prefer direct control without hooks, use the module methods and event listeners:

```typescript
import { AvasOtpAutofillModule } from '@avasapp/react-native-otp-autofill'

// Get app signature hash (use the first one)
const getAppHash = async (): Promise<string | undefined> => {
  try {
    const hashes = await AvasOtpAutofillModule.getHash()
    console.log('App signature hashes:', hashes)
    return hashes[0]
  } catch (error) {
    console.error('Error getting app hash:', error)
  }
}

// Start listening for SMS and wire up events
const startSmsListener = async () => {
  const subs = [] as import('expo-modules-core').EventSubscription[]

  subs.push(
    AvasOtpAutofillModule.addListener('onSmsReceived', ({ otp, message }) => {
      console.log('OTP received:', otp)
      console.log('Full message:', message)
      // ...verify with your backend
    }),
  )

  subs.push(
    AvasOtpAutofillModule.addListener('onTimeout', ({ message }) => {
      console.log('SMS timeout:', message)
    }),
  )

  subs.push(
    AvasOtpAutofillModule.addListener('onError', ({ message, code }) => {
      console.error('SMS error:', message, 'code:', code)
    }),
  )

  await AvasOtpAutofillModule.startOtpListener()

  // Return a cleanup function
  return () => {
    subs.forEach((s) => s.remove())
    AvasOtpAutofillModule.stopSmsRetriever()
  }
}
```

#### Manual example (React component)

```tsx
import React, { useRef, useState } from 'react'
import { Button, Text, View } from 'react-native'
import { AvasOtpAutofillModule } from '@avasapp/react-native-otp-autofill'

export const ManualSmsVerification = () => {
  const [otp, setOtp] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isListening, setIsListening] = useState(false)
  const cleanupRef = useRef<null | (() => void)>(null)

  const start = async () => {
    if (isListening) return
    setIsListening(true)
    setOtp(null)
    setMessage(null)

    // Register listeners first
    const subs = [
      AvasOtpAutofillModule.addListener('onSmsReceived', ({ otp, message }) => {
        setOtp(otp ?? null)
        setMessage(message)
        setIsListening(false)
        cleanup()
      }),
      AvasOtpAutofillModule.addListener('onTimeout', () => {
        setIsListening(false)
        cleanup()
      }),
      AvasOtpAutofillModule.addListener('onError', () => {
        setIsListening(false)
        cleanup()
      }),
    ]

    const cleanup = () => {
      subs.forEach((s) => s.remove())
      AvasOtpAutofillModule.stopSmsRetriever()
      cleanupRef.current = null
    }

    cleanupRef.current = cleanup
    await AvasOtpAutofillModule.startOtpListener()
  }

  const stop = () => {
    cleanupRef.current?.()
    setIsListening(false)
  }

  return (
    <View>
      <Button title={isListening ? 'Listening…' : 'Start SMS Listener'} onPress={start} disabled={isListening} />
      {isListening && <Button title="Stop" onPress={stop} />}
      {otp && <Text>OTP: {otp}</Text>}
      {message && <Text>Message: {message}</Text>}
    </View>
  )
}
```

## API Reference

### React Hooks

#### `useGetHash(options?: UseGetHashOptions): UseGetHashReturn`

A React hook for managing app signature hash retrieval with automatic loading states and error handling.

**Options:**

```typescript
interface UseGetHashOptions {
  onSuccess?: (value: string) => void
  onError?: (error: Error) => void
}
```

**Returns:**

```typescript
interface UseGetHashReturn {
  hash: string | null // The app signature hash
  loading: boolean // Whether hash is being fetched
  error: Error | null // Any error that occurred
  refetch: () => Promise<void> // Function to refetch the hash
}
```

**Example:**

```typescript
const { hash, loading, error, refetch } = useGetHash({
  onSuccess: (hash) => console.log('Hash:', hash),
  onError: (error) => console.error('Error:', error),
})
```

#### `useOtpListener(options?: UseOtpListenerOptions): UseOtpListenerReturn`

A React hook for managing SMS OTP listening with automatic cleanup and state management.

**Options:**

```typescript
interface UseOtpListenerOptions {
  onOtpReceived?: (otp: string, message: string) => void
  onTimeout?: (message: string) => void
  onError?: (error: string, code: number) => void
}
```

**Returns:**

```typescript
interface UseOtpListenerReturn {
  isListening: boolean // Whether actively listening for SMS
  loading: boolean // Whether starting/stopping listener
  receivedOtp: string | null // Last received OTP
  receivedMessage: string | null // Full SMS message
  error: string | null // Any error message
  startListener: () => Promise<void> // Start listening for SMS
  stopListener: () => void // Stop listening and cleanup
}
```

**Example:**

```typescript
const { isListening, receivedOtp, startListener, stopListener } =
  useOtpListener({
    onOtpReceived: (otp, message) => {
      console.log('OTP:', otp, 'Message:', message)
    },
  })
```

### Manual Methods

#### `getOtp(): Promise<boolean>`

Starts the SMS retriever and returns whether it was successfully started.

```typescript
const success = await AvasOtpAutofill.getOtp()
```

#### `getHash(): Promise<string[]>`

Returns the app signature hashes needed for SMS verification.

```typescript
const hashes = await AvasOtpAutofill.getHash()
```

#### `requestHint(): Promise<string>`

Requests a phone number hint (placeholder implementation).

```typescript
const hint = await AvasOtpAutofill.requestHint()
```

#### `startOtpListener(): Promise<boolean>`

Starts listening for SMS using the Android SMS Retriever API.

```typescript
await AvasOtpAutofillModule.startOtpListener()
```

#### `addListener(eventName, listener): EventSubscription`

Adds a listener for module events. Call before `startOtpListener()`.

```typescript
const sub = AvasOtpAutofillModule.addListener('onSmsReceived', ({ otp, message }) => {
  console.log('OTP:', otp, 'Message:', message)
})
```

#### Cleanup

Use the returned subscription to remove listeners, and stop the retriever when done.

```typescript
sub.remove()
await AvasOtpAutofillModule.stopSmsRetriever()
```

### Events

The module emits the following events:

- `onSmsReceived`: When an SMS is received with OTP
- `onTimeout`: When SMS retriever times out (after 5 minutes)
- `onError`: When an error occurs

Event payloads:

```ts
type SmsReceivedEventPayload = {
  message: string
  otp: string | null
}

type TimeoutEventPayload = {
  message: string
}

type ErrorEventPayload = {
  message: string
  code: number
}
```

## SMS Format Requirements

For the SMS Retriever API to work, the SMS message must:

1. Contain a verification code (4-6 digits)
2. Include your app's signature hash
3. Be no longer than 140 bytes
4. Contain a one-time code that the user has never seen before

### Example SMS Format

```
Your verification code is: 123456

FA+9qCX9VSu
```

Where `FA+9qCX9VSu` is your app's signature hash.

## Troubleshooting

### Common Issues

1. **SMS not received**: Ensure your SMS includes the correct app signature hash
2. **Module not found**: Make sure the module is properly installed and linked
3. **Timeout errors**: SMS Retriever has a 5-minute timeout limit
4. **Hooks not updating**: Make sure you're using the hooks inside React components
5. **Multiple listeners**: Use `stopListener()` before starting a new listener

### Debug Mode

#### Using Hooks for Debugging

```typescript
import { useGetHash, useOtpListener } from '@avasapp/react-native-otp-autofill'

const DebugComponent = () => {
  const { hash, loading, error } = useGetHash({
    onSuccess: (hash) => console.log('✅ Hash loaded:', hash),
    onError: (error) => console.error('❌ Hash error:', error),
  })

  const {
    isListening,
    receivedOtp,
    receivedMessage,
    error: smsError,
  } = useOtpListener({
    onOtpReceived: (otp, message) => {
      console.log('📱 SMS received:', { otp, message })
    },
    onTimeout: (message) => {
      console.log('⏰ SMS timeout:', message)
    },
    onError: (error, code) => {
      console.error('❌ SMS error:', { error, code })
    },
  })

  return (
    <div>
      <p>Hash: {hash || 'Loading...'}</p>
      <p>Listening: {isListening ? 'Yes' : 'No'}</p>
      <p>OTP: {receivedOtp || 'None'}</p>
      {error && <p>Hash Error: {error.message}</p>}
      {smsError && <p>SMS Error: {smsError}</p>}
    </div>
  )
}
```

#### Manual Event Debugging

```typescript
import { AvasOtpAutofillModule } from '@avasapp/react-native-otp-autofill'

// Listen to all events for debugging
AvasOtpAutofillModule.addListener('onSmsReceived', (event) => {
  console.log('📱 SMS received:', event)
})

AvasOtpAutofillModule.addListener('onTimeout', (event) => {
  console.log('⏰ SMS timeout:', event)
})

AvasOtpAutofillModule.addListener('onError', (event) => {
  console.log('❌ SMS error:', event)
})
```

### Performance Tips

1. **Use hooks at component level**: Don't call hooks conditionally or in loops
2. **Clean up listeners**: Always call `stopListener()` when component unmounts
3. **Avoid multiple hash fetches**: Use `refetch()` from `useGetHash` instead of creating new instances
4. **Handle loading states**: Show loading indicators to improve user experience

## Development

### Building the Module

```bash
# Install dependencies
bun install

# Build the module
bun run build

# Clean build artifacts
bun run clean

# Run linting
bun run lint

# Run tests
bun run test
```

### Publishing

This package is published to the npm registry. To publish a new version:

1. **Update the version** in `package.json`
2. **Build and publish**:
   ```bash
   bun run build
   npm publish --access public
   ```

### Local Development

For local development and testing:

```bash
# Link the package locally
bun link

# In your test project
bun link @avasapp/react-native-otp-autofill
```

## License

MIT
