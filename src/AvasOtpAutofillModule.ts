import { AvasOtpAutofillModulesType } from './AvasOtpAutofill.types'
import { EventSubscription } from 'expo-modules-core'

// Mock implementation for non-Android platforms (iOS/web). SMS Retriever is
// Android-only; these are inert no-ops. The hooks additionally short-circuit on
// non-Android so callers get a clean "unsupported" signal rather than a fake error.
const AvasOtpAutofillModule: AvasOtpAutofillModulesType = {
  getHash: () => Promise.resolve([]),
  startOtpListener: () => Promise.resolve(false),
  stopSmsRetriever: () => Promise.resolve('SMS Retriever stopped'),
  addListener: () =>
    ({
      remove: () => {},
    } as EventSubscription),
}

export default AvasOtpAutofillModule
