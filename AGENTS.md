# AGENTS.md

Guidance for coding agents working on this repo. User-facing docs are in `README.md`; setup for contributors is in `CONTRIBUTING.md`.

## What this is

`@avasapp/react-native-otp-autofill` (the repo name differs from the package name): a React Native Turbo Module (New Architecture only) that wraps Android's SMS Retriever API. Android only; on iOS and web `isSupported` is false and nothing native is looked up. Works in bare RN and Expo dev builds; it has no `expo` dependency.

Public surface (`src/index.ts`): `useOtp()`, `waitForOtp()`, `getAppHash()`, `extractOtp()`, `isSupported`, `setLogger()`, `OtpError` and their types. There is no default export.

## Layout

- `src/NativeOtpAutofill.ts`: codegen spec, module name `OtpAutofill`. `getAppHash()`, `startListening()` (resolves with the raw SMS body; rejects `TIMEOUT` / `CANCELLED` / `UNAVAILABLE` / `FAILED`), `stopListening()`. No events.
- `src/native.android.ts` re-exports the spec module; `src/native.ts` is null for other platforms.
- `src/api.ts`: `waitForOtp` maps native codes to `OtpError` codes (`CANCELLED` becomes `ABORTED`) and tracks the active wait so aborting a superseded wait can't stop a newer one.
- `src/extractOtp.ts`: OTP extraction lives in JS, not Kotlin.
- `src/logger.ts`: `setLogger` events, emitted from `src/api.ts`. Native failures reach JS as rejections, so there is no native log channel. Never put the SMS body or the code in an event; `__tests__/logger.test.ts` checks this.
- `android/src/main/java/com/avasapp/otpautofill/`: `OtpAutofillModule.kt`, `SmsBroadcastReceiver.kt` (parses the intent only), `AppSignatureHelper.kt`, `OtpAutofillPackage.kt`.
- `lib/`: `bob build` output, gitignored but published. `react-native.config.js` disables iOS autolinking.
- `example/`: bare RN 0.86 app (not a workspace; own `bun install`) that links the library from `..` and resolves `src/` through the `avasapp-react-native-otp-autofill-source` export condition.

## Commands

Bun (`bun.lock`), Node 22 (`.nvmrc`). `bun install` runs `bob build` via `prepare`.

```sh
bun install
bun run test       # jest, __tests__/
bun run lint       # eslint.config.mjs; React Compiler rules are errors
bun run typecheck  # tsc, also checks example/src
bun run build      # bob build -> lib/
```

Example app: `cd example && bun install && bun run android`. On the build box, build through `dhoni build --remote --platform=android example`.

## Gotchas

- The app hash is 11 characters of standard base64 (`A-Za-z0-9+/`) from the signing certificate, so debug, upload and Play App Signing keys differ. Prefer `getAppHash()` at runtime.
- Extraction strips the trailing app-hash line, prefers a code after a keyword like "code" or "otp", then any standalone 4 to 8 digit run. `length` / `pattern` override that.
- Native listener state is only touched on the main thread (`mainHandler.post`), and every result settles only the promise it was started with. Keep it that way; lifecycle races caused most v1 bugs. Cover races in `__tests__/` (`nativeMock.ts` mirrors the native start/stop semantics).
- The receiver is registered before `startSmsRetriever()` so an immediate SMS isn't missed. Never log the SMS body.
- Log tags: `OtpAutofill`, `SmsBroadcastReceiver`.
- Jest resolves the iOS variant of `src/native`, so tests that need the module mock `../src/native`.

## Releases

`.github/workflows/publish.yml` publishes on a `v*` tag push: it checks the tag matches `package.json`, runs lint, typecheck, tests and build, then `npm publish --provenance`. Prerelease versions (with a `-`, e.g. `2.0.0-beta.0`) go to the `next` dist-tag, others to `latest`. There is no PR CI. A release is a `chore: release vX.Y.Z` commit bumping `package.json`, then a tag. Do not bump the version, tag or publish in a contribution.

## Compatibility

Peers: `react >= 18.3`, `react-native >= 0.76` (New Architecture). `android/build.gradle` defaults `minSdkVersion` 24 and `compileSdkVersion` 36, overridable by the host app.

## Conventions

- Prettier style from `.prettierrc`: single quotes, no semicolons, trailing commas, 2-space indent. Lint enforces it.
- Commits use Conventional Commits: `fix: ...`, `feat: ...`, `build: ...`, `docs: ...`, `chore: ...`, with optional scopes.
- PRs go into `main`. Test changes on a real Android device or emulator using the example app, and say how you tested.
