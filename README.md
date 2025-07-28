# Avas React Native OTP Autofill

An Expo module for automatic SMS verification using Android SMS Retriever API.

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

This module is available as a npm package. To use it in your Expo/React Native app:

### npm
```bash
npm install @avas/react-native-otp-autofill
```

### bun
```bash
bun add @avas/react-native-otp-autofill
```

### Quick Start

After installation, you can use the React hooks for the simplest integration:

```typescript
import { useGetHash, useOtpListener } from '@avas/react-native-otp-autofill'

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
import { useGetHash } from '@avas/react-native-otp-autofill'

const AppHashComponent = () => {
  const { hash, loading, error, refetch } = useGetHash({
    onSuccess: (hash) => {
      console.log('App hash loaded:', hash)
    },
    onError: (error) => {
      console.error('Failed to get app hash:', error)
    }
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
import { useOtpListener } from '@avas/react-native-otp-autofill'

const SmsVerificationComponent = () => {
  const {
    isListening,
    loading,
    receivedOtp,
    receivedMessage,
    error,
    startListener,
    stopListener
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
    }
  })

  return (
    <div>
      <button onClick={startListener} disabled={isListening || loading}>
        {loading ? 'Starting...' : isListening ? 'Listening...' : 'Start SMS Listener'}
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
import { useGetHash, useOtpListener } from '@avas/react-native-otp-autofill'

const SmsVerificationFlow = () => {
  const [step, setStep] = useState<'hash' | 'sms' | 'complete'>('hash')
  const [phoneNumber, setPhoneNumber] = useState('')

  // Get app hash first
  const { hash, loading: hashLoading, error: hashError } = useGetHash({
    onSuccess: (hash) => {
      console.log('Ready to send SMS with hash:', hash)
      setStep('sms')
    }
  })

  // Listen for SMS
  const {
    isListening,
    receivedOtp,
    startListener,
    stopListener
  } = useOtpListener({
    onOtpReceived: (otp) => {
      console.log('Verification complete:', otp)
      setStep('complete')
      stopListener()
    }
  })

  const sendSms = async () => {
    if (!hash) return

    // Send SMS with your backend API
    await fetch('/api/send-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber,
        appHash: hash
      })
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

### Manual Event Management API

For advanced use cases or when you need more control over event handling, you can use the manual API:

```typescript
import AvasOtpAutofill from '@avas/react-native-otp-autofill'

// Get app signature hash
const getAppHash = async () => {
  try {
    const hashes = await AvasOtpAutofill.getHash()
    console.log('App signature hashes:', hashes)
    return hashes[0] // Use the first hash
  } catch (error) {
    console.error('Error getting app hash:', error)
  }
}

// Start listening for SMS
const startSmsListener = async () => {
  try {
    const subscription = await AvasOtpAutofill.startOtpListener((otp: string) => {
      console.log('OTP received:', otp)
      // Use the OTP for verification
      verifyOTP(otp)
    })

    // Clean up when done
    // subscription.remove();
  } catch (error) {
    console.error('Error starting SMS listener:', error)
  }
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

#### `startOtpListener(handler: (otp: string) => void): Promise<EventSubscription>`

Starts listening for SMS and calls the handler when an OTP is received.

```typescript
const subscription = await AvasOtpAutofill.startOtpListener((otp) => {
  console.log('Received OTP:', otp)
})
```

#### `addListener(handler: (otp: string) => void): EventSubscription`

Adds a listener for SMS events without starting the retriever.

```typescript
const subscription = AvasOtpAutofill.addListener((otp) => {
  console.log('Received OTP:', otp)
})
```

#### `removeListener(): void`

Removes all listeners and stops the SMS retriever.

```typescript
AvasOtpAutofill.removeListener()
```

### Events

The module emits the following events:

- `onSmsReceived`: When an SMS is received with OTP
- `onTimeout`: When SMS retriever times out (after 5 minutes)
- `onError`: When an error occurs

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
import { useGetHash, useOtpListener } from '@avas/react-native-otp-autofill'

const DebugComponent = () => {
  const { hash, loading, error } = useGetHash({
    onSuccess: (hash) => console.log('✅ Hash loaded:', hash),
    onError: (error) => console.error('❌ Hash error:', error)
  })

  const {
    isListening,
    receivedOtp,
    receivedMessage,
    error: smsError
  } = useOtpListener({
    onOtpReceived: (otp, message) => {
      console.log('📱 SMS received:', { otp, message })
    },
    onTimeout: (message) => {
      console.log('⏰ SMS timeout:', message)
    },
    onError: (error, code) => {
      console.error('❌ SMS error:', { error, code })
    }
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
import { AvasOtpAutofillModule } from '@avas/react-native-otp-autofill'

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

## License

MIT
