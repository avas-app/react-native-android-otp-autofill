# AGENTS.md

Guidance for coding agents working on this repo. User-facing docs are in `README.md`; setup for contributors is in `CONTRIBUTING.md`.

## What this is

`@avasapp/react-native-otp-autofill` (the repo name differs from the package name): a React Native Turbo Module (New Architecture only) that wraps Android's SMS Retriever API. Android only; on iOS and web `isSupported` is false and nothing native is looked up. Works in bare RN and Expo dev builds; it has no `expo` dependency.

Public surface (`src/index.ts`): `useOtp()`, `waitForOtp()`, `getAppHash()`, `extractOtp()`, `isSupported`, `setLogger()`, `OtpError` and their types. There is no default export.

## Layout

- `src/NativeOtpAutofill.ts`: codegen spec, module name `OtpAutofill`. `getAppHash()`, `startListening()` (resolves with the raw SMS body; rejects `TIMEOUT` / `CANCELLED` / `UNAVAILABLE` / `FAILED`), `stopListening()`. No events.
- `src/native.android.ts` re-exports the spec module; `src/native.ts` is null for other platforms. `src/api.ts` checks `Platform.OS` to tell "not Android" from "Android without the module" (logs `module.missing` once, and `UNSUPPORTED` says to rebuild).
- `src/api.ts`: `waitForOtp` maps native codes to `OtpError` codes (`CANCELLED` becomes `ABORTED`) and tracks the active wait so aborting a superseded wait can't stop a newer one. Every rejection is an `OtpError`, including `INVALID_OPTIONS` for bad options. `useOtp` treats `ABORTED` as idle, not an error.
- `src/extractOtp.ts`: OTP extraction lives in JS, not Kotlin.
- `src/logger.ts`: `setLogger` events, emitted from `src/api.ts`. Native failures reach JS as rejections, so there is no native log channel. Never put the SMS body or the code in an event; `__tests__/logger.test.ts` checks this.
- `android/src/main/java/com/avasapp/otpautofill/`: `OtpAutofillModule.kt` (adapter), `SmsSession.kt` (the session rules, no Android types; tests in `android/src/test`), `SmsBroadcastReceiver.kt` (parses the intent only), `AppSignatureHelper.kt`, `OtpAutofillPackage.kt`.
- `lib/`: `bob build` output, gitignored but published. `react-native.config.js` disables iOS autolinking.
- `example/`: bare RN 0.86 app (not a workspace; own `bun install`) that links the library from `..` and resolves `src/` through the `avasapp-react-native-otp-autofill-source` export condition.

## Commands

Bun (`bun.lock`), Node 22 (`.nvmrc`). `bun install` runs `bob build` via `prepare`.

```sh
bun install
bun run test       # jest, __tests__/
bun run test:android  # JUnit for SmsSession through example/android (needs JDK 17 and `bun install` in example/)
bun run lint       # oxlint (.oxlintrc.json); React Compiler rules are errors
bun run format     # oxfmt (.oxfmtrc.json); format:check in CI
bun run typecheck  # tsc, also checks example/src
bun run build      # bob build -> lib/
```

Example app: `cd example && bun install && bun run android`. On the build box, build through `dhoni build --remote --platform=android example`.

## Gotchas

- The app hash is 11 characters of standard base64 (`A-Za-z0-9+/`) from the signing certificate, so debug, upload and Play App Signing keys differ. Prefer `getAppHash()` at runtime.
- Extraction strips the app hash (same line or last line), takes only whole-token digit runs (not `1500.00`, `1,500`, `A1234`), and returns null unless exactly one distinct candidate is left and every run of 3+ digits in any script equals it: a wrong code that gets auto-submitted is worse than no autofill, and a lone rival number must not win when the real code is split or non-ASCII. There is no keyword preference (it returned amounts and order numbers); apps whose SMS holds other numbers pass a `pattern`. Don't add keyword, currency or locale word lists. `length` narrows the digit run; `pattern` replaces all of it.
- Native listener state is only touched on the main thread (`mainHandler.post`), and every result settles only the promise it was started with. Keep it that way; lifecycle races caused most v1 bugs. Cover races in `__tests__/` (`nativeMock.ts` mirrors the native start/stop semantics, including that start and stop settle in order after the call returns; `await native.settled()` before checking `native.listening`).
- Android gives an app one SMS Retriever session, 5 minutes from the first `startSmsRetriever()`; starting again inside it or after it expired (before its `TIMEOUT` broadcast) does nothing, and expiry is only acted on lazily (the broadcast comes minutes late, or when the next matching SMS arrives, which is then consumed). `SmsSession.kt` is plain Kotlin with no Android types and holds those rules, with JUnit tests in `android/src/test` (`bun run test:android`); `OtpAutofillModule.kt` is a thin adapter. The receiver lives for the session, not the wait. A wait attaches to an open session; on an expired one it calls `startSmsRetriever()` again and gets a deadline from now; a `TIMEOUT` broadcast reopens one session per wait if the wait's deadline (an `elapsedRealtime` value) hasn't passed, and the deadline moves to 5 minutes from the reopen; a second one rejects. A wait's `TIMEOUT` comes from that deadline, so it is at most 5 minutes after its session (re)opened. State is in memory, so a JS reload or process restart forgets the session.
- The receiver is registered before `startSmsRetriever()` so an immediate SMS isn't missed. Never log the SMS body.
- Log tags: `OtpAutofill`, `SmsBroadcastReceiver`.
- Jest resolves the iOS variant of `src/native`, so tests that need the module mock `../src/native`.

## Releases

`.github/workflows/publish.yml` publishes on a `v*` tag push: it checks the tag matches `package.json`, runs lint, format check, typecheck, tests, build and the Android JUnit tests (`bun run test:android`, JDK 17; not run locally by Actions), then `npm publish --provenance`. It refuses a tag whose commit is not on `origin/main`, installs with `bun install --frozen-lockfile` and the Bun version from `packageManager`. The on-main check runs before `bun install`, because `prepare` runs scripts. A prerelease goes to `next` if its major is at least the majors of the current `latest` and `next`, else to `v<major>-next`. A stable version goes to `latest` only if it is higher than the current `latest` on npm, else `v<major>-latest` (a hotfix on an older major). Auth is the `NPM_TOKEN` secret; npm trusted publishing would remove it but the owner must set that up on npm first. There is no PR CI. A release is a `chore: release vX.Y.Z` commit bumping `package.json`, then a tag. Do not bump the version, tag or publish in a contribution.

## Compatibility

Peers: `react >= 18.3`, `react-native >= 0.76` (New Architecture). `android/build.gradle` defaults `minSdkVersion` 24 and `compileSdkVersion` 36, overridable by the host app.

## Conventions

- oxfmt style from `.oxfmtrc.json`: single quotes, no semicolons, trailing commas, 2-space indent. Run `bun run format`; the publish workflow runs `format:check`.
- oxlint loads `eslint-plugin-react-hooks` as the `react-compiler` JS plugin, because native oxlint lacks the React Compiler rules. `eslint-disable` comments still work.
- Commits use Conventional Commits: `fix: ...`, `feat: ...`, `build: ...`, `docs: ...`, `chore: ...`, with optional scopes.
- PRs go into `main`. Test changes on a real Android device or emulator using the example app, and say how you tested.
