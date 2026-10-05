# AGENTS.md

Guidance for coding agents working on this repo. User-facing docs are in `README.md`; setup for contributors is in `CONTRIBUTING.md`.

## What this is

`@avasapp/react-native-otp-autofill` (the repo name differs from the package name): an Expo Modules API module that wraps Android's SMS Retriever API. Android only; on iOS and web the module is an inert stub.

Public surface (`src/index.ts`):

- Hooks: `useGetHash()` (app signature hash, with `loading` / `error` / `refetch`) and `useOtpListener()` (`startListener`, `stopListener`, `receivedOtp`, `receivedMessage`, `isListening`, callbacks `onOtpReceived` / `onTimeout` / `onError`). Both short-circuit when `Platform.OS !== 'android'`.
- `AvasOtpAutofillModule` (also the default export): `getHash()`, `startOtpListener()`, `stopSmsRetriever()`, `addListener()` for `onSmsReceived`, `onTimeout`, `onError`.
- Types from `src/AvasOtpAutofill.types.ts`.

## Layout

- `src/AvasOtpAutofillModule.android.ts`: `requireNativeModule('AvasOtpAutofill')`. `src/AvasOtpAutofillModule.ts`: the non-Android no-op. `src/module.ts` re-exports; `src/hooks/` holds the hooks.
- `android/src/main/java/avas/modules/otp_autofill/`: `AvasOtpAutofillModule.kt` (module definition, `Name("AvasOtpAutofill")`), `SmsBroadcastReceiver.kt` (receiver plus OTP extraction regexes), `AppSignatureHelper.kt` (11-char app hash). Uses `play-services-auth-api-phone`.
- `expo-module.config.json`: `platforms: ["android"]`. There is no iOS native code.
- `build/`: compiled output from `expo-module build`, gitignored but published.
- `example/`: Expo SDK 53 dev-client app (hooks and manual screens) that autolinks the module from `..`.

## Commands

Bun (`bun.lock`; `.nvmrc` pins Node 20.19.3). `bun install` runs `expo-module prepare` via the `prepare` script.

```sh
bun install
bun run build                    # expo-module build -> build/
bun run lint                     # eslint src (flat config in eslint.config.js)
./node_modules/.bin/tsc --noEmit # typecheck; there is no script, this is what the publish workflow runs
bun run clean
```

`bun run test` runs `expo-module test` (Jest) with `EXPO_NONINTERACTIVE=1` so it never enters watch mode, and `--passWithNoTests` because there are no tests yet (it exits 0 with "No tests found"). If you add tests, put them in a root-level `__tests__/`, which is outside the `files` allowlist and so not published (anything under `src/` ships).

Example app (needs an Android device or emulator with Google Play Services):

```sh
bun run build
cd example && bun install && bun run android
```

The `ios` and `web` scripts in `example/` exist but the module does nothing there.

## Gotchas

- The app hash is 11 characters of standard base64 (`A-Za-z0-9+/`), derived from the signing certificate, so it differs between debug, upload and Play App Signing keys. Prefer the runtime value from `useGetHash` over hardcoding.
- OTP extraction (`SmsBroadcastReceiver.kt`) first strips a trailing app-hash line, then prefers a 4 to 8 digit run near keywords like "code" or "otp", then falls back to any standalone 4 to 8 digit run.
- SMS Retriever times out after 5 minutes. Listener lifecycle has been a source of bugs (register-after-stop leaks, orphaned start promises, cancelled starts); keep start/stop idempotent and cover races when you change `useOtpListener` or the receiver.
- Log tags are `AvasOtpAutofillModule`, `SmsBroadcastReceiver` and `AppSignatureHelper`; filter `adb logcat` on those.
- The lint config enables `react-compiler/react-compiler` as an error and warns on `console`.

## Releases

`.github/workflows/publish.yml` publishes on a `v*` tag push: it checks the tag matches `package.json`, runs lint, typecheck and build, then `npm publish --access public --provenance`. There is no PR CI. A release is a `chore: release vX.Y.Z` commit bumping `package.json`, then a tag. Do not bump the version, tag or publish in a contribution.

## Compatibility

Peers: `expo >= 50`, `react >= 18`, `react-native >= 0.74`. README states Android API 23+ (24+ on Expo SDK 52+, i.e. React Native 0.76+, which raised its `minSdk` to 24) and Google Play Services. `android/build.gradle` defaults `minSdkVersion` 21 and `compileSdkVersion` / `targetSdkVersion` 34, overridable by the host app; the host's Expo / React Native floor is what actually applies.

## Conventions

- Prettier style from `.prettierrc`: single quotes, no semicolons, trailing commas, 2-space indent. There is no format script; format edited files to match.
- Commits use Conventional Commits: `fix: ...`, `build: ...`, `docs: ...`, `chore: ...`, with optional scopes (`chore(lock): ...`).
- PRs go into `main`. Test changes on a real Android device or emulator using the example app, and say how you tested.
