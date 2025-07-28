import { EventSubscription } from 'expo-modules-core'

export type SmsReceivedEventPayload = {
  message: string
  otp: string | null
}

export type TimeoutEventPayload = {
  message: string
}

export type ErrorEventPayload = {
  message: string
  code: number
}

export type UnsubscribeFunction = {
  unsubscribe: () => void
}

export type AvasOtpAutofillModuleEvents = {
  onSmsReceived: (params: SmsReceivedEventPayload) => void
  onTimeout: (params: TimeoutEventPayload) => void
  onError: (params: ErrorEventPayload) => void
}

export type AvasOtpAutofillModulesType = {
  getOtp(): Promise<boolean>
  getHash(): Promise<string[]>
  requestHint(): Promise<string>
  startOtpListener(): Promise<boolean>
  stopSmsRetriever(): Promise<string>
  addListener<T extends keyof AvasOtpAutofillModuleEvents>(
    eventName: T,
    listener: AvasOtpAutofillModuleEvents[T],
  ): EventSubscription
}
