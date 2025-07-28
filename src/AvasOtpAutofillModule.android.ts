import { NativeModule, requireNativeModule } from 'expo'

import { AvasOtpAutofillModuleEvents } from './AvasOtpAutofill.types'

declare class AvasOtpAutofillModule extends NativeModule<AvasOtpAutofillModuleEvents> {
  getOtp(): Promise<boolean>
  getHash(): Promise<string[]>
  requestHint(): Promise<string>
  startOtpListener(): Promise<boolean>
  stopSmsRetriever(): Promise<string>
}

export default requireNativeModule<AvasOtpAutofillModule>('AvasOtpAutofill')
