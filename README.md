# React Native OTP Autofill

Reads one-time codes from SMS on Android with the [SMS Retriever API](https://developers.google.com/identity/sms-retriever/overview), with no SMS permission. A React Native Turbo Module that works in bare React Native and Expo apps.

[![NPM Version](https://img.shields.io/npm/v/%40avasapp%2Freact-native-otp-autofill?style=for-the-badge&color=%23EA3F00)](https://www.npmjs.com/package/@avasapp/react-native-otp-autofill)
![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/avas-app/react-native-android-otp-autofill/publish.yml?style=for-the-badge)

## Requirements

- React Native 0.76+ with the New Architecture (Expo SDK 52+)
- Android 7.0 (API 24)+ with Google Play Services

On iOS and web the library does nothing: `isSupported` is false and `waitForOtp` rejects with `UNSUPPORTED`. On iOS, set `textContentType="oneTimeCode"` on the input so the keyboard offers the code instead.

## Installation

```sh
npm install @avasapp/react-native-otp-autofill
```

Bare React Native apps autolink it. Expo apps need a development build (`npx expo prebuild` or EAS Build); it does not work in Expo Go. No config plugin or permission is needed.

## Usage

### 1. Send the app hash with the SMS

The SMS must end with your app's 11-character hash on its own line:

```
Your code is 482913

FA+9qCX9VSu
```

Read the hash at runtime and send it to the backend that sends the SMS:

```ts
import { getAppHash } from '@avasapp/react-native-otp-autofill'

const hash = await getAppHash() // null on iOS and web
```

The hash comes from the signing certificate, so debug, upload and Play App Signing builds each have a different one. Read it at runtime instead of hardcoding it.

### 2. Wait for the code

```tsx
import { useOtp } from '@avasapp/react-native-otp-autofill'

function OtpScreen({ codeLength }: { codeLength: number }) {
  const { otp, status, start } = useOtp({
    length: codeLength,
    onOtp: (code) => input.current?.setCode(code),
  })

  async function resend() {
    await api.resendCode()
    start() // the retriever delivers one SMS, so re-arm after a resend
  }

  // status: 'idle' | 'listening' | 'received' | 'timeout' | 'error'
}
```

`useOtp` starts listening on mount and stops on unmount. Each wait ends after one SMS or after 5 minutes, so call `start()` again after a resend or a timeout.

Without React, use `waitForOtp`:

```ts
import { waitForOtp, OtpError } from '@avasapp/react-native-otp-autofill'

const controller = new AbortController()
try {
  const { otp, message } = await waitForOtp({
    length: 6,
    signal: controller.signal,
  })
} catch (error) {
  if (error instanceof OtpError && error.code === 'TIMEOUT') {
    // no SMS within 5 minutes
  }
}

// later, e.g. when the screen closes
controller.abort()
```

## API

### `useOtp(options?)`

| Option | Type | Default | |
| --- | --- | --- | --- |
| `autoStart` | `boolean` | `true` | Start listening on mount. |
| `length` | `number` | | Exact code length. |
| `pattern` | `RegExp` | | Custom matcher, instead of `length`. |
| `onOtp` | `(otp, message) => void` | | Called when an SMS with a code arrives. Doesn't need to be memoized. |

Returns `{ status, otp, message, error, start, stop }`. `start()` replaces any wait in progress. `stop()` cancels it and goes back to `idle`. When an SMS arrives with no matching code, `status` is `received` and `otp` is null.

### `waitForOtp(options?): Promise<{ otp, message }>`

Takes `length`, `pattern` and an optional `signal`. Resolves with the extracted code (or null) and the full SMS body. Only one wait runs at a time: starting a new one rejects the previous with `ABORTED`.

### `getAppHash(): Promise<string | null>`

The app hash, or null on platforms without SMS Retriever.

### `extractOtp(message, options?): string | null`

The extraction `waitForOtp` uses, exported for tests and custom flows. It ignores the app-hash line, prefers a code that follows a word like "code" or "OTP", and otherwise takes the first standalone 4 to 8 digit run. `length` changes that range to exactly `length` digits. `pattern` replaces the rules: the first capture group is the code, or the whole match if there is no group.

### `isSupported: boolean`

True on Android when the native module is linked.

### `OtpError`

Rejections are `OtpError`s with a `code`:

| Code | Meaning |
| --- | --- |
| `UNSUPPORTED` | Not Android, or the native module isn't linked (e.g. Expo Go). |
| `UNAVAILABLE` | SMS Retriever couldn't start, usually because Google Play Services is missing or outdated. |
| `TIMEOUT` | No matching SMS within 5 minutes. |
| `ABORTED` | The signal aborted, or a newer wait replaced this one. |
| `FAILED` | Anything else; see `message`. |

## Migrating from v1

v2 is a Turbo Module, so it no longer depends on `expo`, and it needs React Native 0.76+ with the New Architecture.

| v1 | v2 |
| --- | --- |
| `useGetHash()` → `{ hash }` | `getAppHash()` (returns one hash, not an array) |
| `AvasOtpAutofill.getHash()` → `string[]` | `getAppHash()` → `string \| null` |
| `addListener('onSmsReceived')` + `startOtpListener()` + `stopSmsRetriever()` | `useOtp()` or `waitForOtp({ signal })` |
| `onTimeout` / `onError` events | `status` / `error` from `useOtp`, or the `OtpError` rejection |
| `useOtpListener()` | `useOtp()` |
| Filtering `otp.length === n` yourself | `length: n` |
| Default export, `AvasOtpAutofill`, `AvasOtpAutofillModule` | Named exports only |
| Deep imports like `/build/module` | Import from the package root |

A v1 listener effect such as:

```ts
useEffect(() => {
  const sub = AvasOtpAutofill.addListener('onSmsReceived', ({ otp }) => {
    if (otp?.length === codeLength) input.current?.setCode(otp)
  })
  AvasOtpAutofill.startOtpListener()
  return () => {
    sub.remove()
    AvasOtpAutofill.stopSmsRetriever()
  }
}, [codeLength])
```

becomes:

```ts
const { start } = useOtp({
  length: codeLength,
  onOtp: (otp) => input.current?.setCode(otp),
})
```

Call `start()` after a resend, which v1 code often didn't, so a resent code autofills too.

## Troubleshooting

- **No SMS arrives**: the last line must be exactly the hash from `getAppHash()` for the build that's running, and the message must be 140 bytes or less.
- **`UNSUPPORTED` on Android**: the native module isn't in the build. Rebuild the app; Expo Go can't load it.
- **Logs**: `adb logcat -s OtpAutofill SmsBroadcastReceiver`. The SMS body is never logged.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
