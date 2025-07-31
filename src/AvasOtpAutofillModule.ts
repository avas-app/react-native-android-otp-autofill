import { AvasOtpAutofillModulesType } from './AvasOtpAutofill.types'
import { EventSubscription } from 'expo-modules-core'

// This is a mock implementation of the AvasOtpAutofillModule for web/other platforms.
const AvasOtpAutofillModule: AvasOtpAutofillModulesType = {
  getOtp: () => Promise.resolve(false),
  getHash: () => Promise.resolve([]),
  requestHint: () => Promise.resolve(''),
  startOtpListener: () => Promise.resolve(false),
  stopSmsRetriever: () => Promise.resolve('SMS Retriever stopped'),
  addListener: () =>
    ({
      remove: () => {},
    } as EventSubscription),
}

export default AvasOtpAutofillModule
