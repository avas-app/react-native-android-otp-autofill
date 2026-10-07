import { TurboModuleRegistry, type TurboModule } from 'react-native'

export interface Spec extends TurboModule {
  getAppHash(): Promise<string | null>
  // Resolves with the raw SMS body. Rejects with code TIMEOUT, CANCELLED,
  // UNAVAILABLE or FAILED.
  startListening(): Promise<string>
  stopListening(): void
}

export default TurboModuleRegistry.get<Spec>('OtpAutofill')
