# Contributing

## Setup

You need Node 22 (see `.nvmrc`), [Bun](https://bun.sh/), the Android SDK and an Android device or emulator with Google Play Services.

```sh
bun install          # also builds lib/ through the prepare script
bun run test         # Jest, in __tests__/
bun run lint         # oxlint
bun run format       # oxfmt
bun run typecheck
bun run build        # bob build -> lib/
```

## Example app

`example/` is a bare React Native app that links the library from `..` and imports `src/` directly, so JS changes show up through Fast Refresh. Kotlin changes need a rebuild.

```sh
cd example
bun install
bun run android
```

The app shows its app hash. Send an SMS that ends with it, from another phone or the emulator's extended controls:

```
Your code is 482913

<hash>
```

Press **Start**, then send the SMS; the status should go to `received` with the code. The example is signed with the committed `example/android/app/debug.keystore`, so its hash is the same on every device.

## Layout

- `src/NativeOtpAutofill.ts`: the Turbo Module spec that codegen reads.
- `src/native.ts` / `src/native.android.ts`: the module on Android, null elsewhere.
- `src/api.ts`: `getAppHash`, `waitForOtp`, `isSupported`.
- `src/useOtp.ts`, `src/extractOtp.ts`, `src/OtpError.ts`.
- `android/src/main/java/com/avasapp/otpautofill/`: `OtpAutofillModule.kt` (start/stop and the pending promise), `SmsBroadcastReceiver.kt`, `AppSignatureHelper.kt`, `OtpAutofillPackage.kt`.

Listener lifecycle has caused bugs before. If you change `waitForOtp`, `useOtp` or the module, cover the race in `__tests__/` (`nativeMock.ts` mirrors the native start/stop behaviour) and test on a device.

## Style and commits

Formatting is oxfmt (`.oxfmtrc.json`: single quotes, no semicolons, trailing commas). Run `bun run format` before committing; CI runs `bun run format:check`. Commits follow Conventional Commits (`fix: ...`, `feat: ...`, `docs: ...`). Open PRs against `main` and say how you tested on Android.
