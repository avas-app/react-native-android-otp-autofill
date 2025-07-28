# Contributing to Avas React Native OTP Autofill

Thank you for your interest in contributing to this project! This guide will help you get started with development and testing.

## Prerequisites

Before you begin, ensure you have the following installed:

- [Node.js](https://nodejs.org/) (version 18 or higher)
- [Bun](https://bun.sh/) (recommended) or npm
- [Android Studio](https://developer.android.com/studio) with Android SDK
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- An Android device or emulator for testing

## Development Setup

### 1. Clone the Repository

```bash
git clone https://github.com/avas-app/react-native-android-otp-autofill.git
cd react-native-android-otp-autofill
```

### 2. Install Dependencies

Using bun (recommended):
```bash
bun install
```

Or using npm:
```bash
npm install
```

### 3. Build the Module

```bash
bun run build
```

## Running the Example App

The example app demonstrates all the features of the OTP autofill module and is essential for testing your changes.

### 1. Navigate to Example Directory

```bash
cd example
```

### 2. Install Example Dependencies

Using bun:
```bash
bun install
```

Or using npm:
```bash
npm install
```

### 3. Start the Development Server

```bash
bun start
# or
npm start
```

This will start the Expo development server and show a QR code.

### 4. Run on Android

For the SMS Retriever API to work, you **must** run on an Android device or emulator:

```bash
bun run android
# or
npm run android
```

**Note**: The SMS Retriever API only works on Android devices with Google Play Services. iOS is not supported.

### 5. Testing SMS Functionality

To test the SMS autofill functionality:

1. **Get App Hash**: Tap the "Get App Hash" button in the example app to retrieve your app's signature hash
2. **Copy the Hash**: The hash will be displayed and automatically copied to clipboard
3. **Send SMS**: Use a service like Twilio or send manually from another device with this format:
   ```
   Your verification code is: 123456
   
   [YOUR_APP_HASH]
   ```
4. **Start Listener**: Tap "Start SMS Listener" in the app
5. **Receive SMS**: The app should automatically detect and extract the OTP

## Development Workflow

### 1. Making Changes

1. Make your changes to the source code in the `src/` directory
2. Build the module: `bun run build`
3. Test your changes in the example app

### 2. Code Style

This project uses ESLint for code formatting. Run the linter:

```bash
bun run lint
```

### 3. Testing

Run the test suite:

```bash
bun run test
```

## Project Structure

```
react-native-android-otp-autofill/
├── src/                          # Source code
│   ├── hooks/                    # React hooks
│   │   ├── useGetHash.ts        # Hook for app hash retrieval
│   │   └── useOtpListener.ts    # Hook for SMS listening
│   ├── AvasOtpAutofillModule.ts # Main module interface
│   └── index.ts                 # Public exports
├── android/                      # Native Android implementation
│   └── src/main/java/avas/modules/otp_autofill/
│       ├── AvasOtpAutofillModule.kt
│       ├── SmsBroadcastReceiver.kt
│       └── AppSignatureHelper.kt
├── example/                      # Example application
│   ├── App.tsx                  # Main example component
│   └── package.json             # Example dependencies
└── build/                       # Compiled output
```

## Key Files to Understand

### TypeScript/React Files
- `src/AvasOtpAutofillModule.ts` - Main module interface and event handling
- `src/hooks/useGetHash.ts` - React hook for hash retrieval with state management
- `src/hooks/useOtpListener.ts` - React hook for SMS listening with cleanup
- `example/App.tsx` - Complete example demonstrating all features

### Android Native Files
- `android/src/main/java/avas/modules/otp_autofill/AvasOtpAutofillModule.kt` - Expo module implementation
- `android/src/main/java/avas/modules/otp_autofill/SmsBroadcastReceiver.kt` - SMS broadcast receiver
- `android/src/main/java/avas/modules/otp_autofill/AppSignatureHelper.kt` - App signature hash generation

## Debugging Tips

### 1. Enable Debug Logging

In the example app, all events are logged to the console. Check the Metro bundler logs or use `adb logcat` for Android logs:

```bash
adb logcat -s "AvasOtpAutofill"
```

### 2. Common Issues

- **SMS not received**: Verify the SMS contains the correct app signature hash
- **Module build errors**: Make sure you've run `bun run build` after making changes
- **Android build issues**: Clean and rebuild the example app:
  ```bash
  cd example
  bun run android --clear
  ```

### 3. Testing Without Real SMS

For development, you can trigger events manually in the native code or use the example app's debug features.

## Making a Pull Request

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Make your changes and test them thoroughly
4. Build the project: `bun run build`
5. Run tests: `bun run test`
6. Run linter: `bun run lint`
7. Commit your changes with a clear message
8. Push to your fork and create a Pull Request

### Pull Request Guidelines

- Include a clear description of what your changes do
- Add tests for new functionality
- Update documentation if needed
- Test the example app on Android device/emulator
- Include screenshots or videos for UI changes

## API Design Principles

When contributing to this module, keep these principles in mind:

1. **React-First**: Prioritize React hooks for the primary API
2. **Backward Compatibility**: Maintain the manual event API for advanced users
3. **Error Handling**: Provide clear error messages and proper error states
4. **Performance**: Minimize re-renders and memory leaks
5. **Android Focus**: This module is Android-only due to platform limitations

## Getting Help

If you need help:

1. Check the existing [Issues](https://github.com/avas-app/react-native-android-otp-autofill/issues)
2. Read the main [README.md](./README.md) for usage examples
3. Look at the example app implementation
4. Create a new issue with a clear description of your problem

Thank you for contributing! 🚀
