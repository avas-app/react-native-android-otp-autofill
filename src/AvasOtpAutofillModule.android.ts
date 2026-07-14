import { NativeModule, requireNativeModule } from 'expo'

import { AvasOtpAutofillModuleEvents } from './AvasOtpAutofill.types'

declare class AvasOtpAutofillModule extends NativeModule<AvasOtpAutofillModuleEvents> {
  getHash(): Promise<string[]>
  startOtpListener(): Promise<boolean>
  stopSmsRetriever(): Promise<string>
}

export default requireNativeModule<AvasOtpAutofillModule>('AvasOtpAutofill')
